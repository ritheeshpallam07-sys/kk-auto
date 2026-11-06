import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthService } from '../services/authService';
import { AuditService } from '../services/auditService';
import { query, withTransaction } from '../config/db';

/**
 * Safely resolves the connecting client IP behind reverse proxies (Cloudflare + Render).
 * Prioritizes verified CF-Connecting-IP if present and valid; otherwise relies on Express req.ip (trust proxy: 1).
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers ? req.headers['cf-connecting-ip'] : undefined;
  if (typeof cfIp === 'string' && cfIp.trim() && /^[a-fA-F0-9:.]+$/.test(cfIp.trim())) {
    return cfIp.trim();
  }
  return req.ip || req.socket?.remoteAddress || '127.0.0.1';
}

export class AuthController {
  public static async register(req: Request, res: Response) {
    try {
      // CONF-07-D: IP-based rate limiting on registration requests
      const clientIp = getClientIp(req);
      const ipLimit = await AuthService.checkRateLimit(`reg_ip_${clientIp}`, 15, 900);
      if (!ipLimit.allowed) {
        if (ipLimit.isServiceUnavailable) {
          return res.status(503).json({
            success: false,
            error: 'Authentication service temporarily unavailable. Please try again later.'
          });
        }
        if (typeof res.set === 'function') {
          res.set('Retry-After', String(ipLimit.retryAfterSeconds));
        }
        return res.status(429).json({
          success: false,
          error: 'Too many registration requests from this IP. Please try again later.'
        });
      }

      const {
        name,
        email,
        mobile,
        password,
        confirmPassword,
        role,
        autoNumber,
        autoModel,
        licenseNumber,
        payoutUpi,
        payoutBankAccount,
        payoutIfsc
      } = req.body;

      if (!password || !confirmPassword) {
        return res.status(400).json({ success: false, error: 'Password and confirmation are required.' });
      }

      if (password !== confirmPassword) {
        return res.status(400).json({ success: false, error: 'Passwords do not match.' });
      }

      const result = await AuthService.register({
        name,
        email,
        mobile,
        password,
        role: role || 'customer',
        autoNumber,
        autoModel,
        licenseNumber,
        payoutUpi,
        payoutBankAccount,
        payoutIfsc
      });

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully. If eligible, a verification code has been sent to your email.',
        data: result
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 400;
      if (err.retryAfterSeconds && typeof res.set === 'function') {
        res.set('Retry-After', String(err.retryAfterSeconds));
      }
      return res.status(statusCode).json({ success: false, error: err.message || 'Registration failed.' });
    }
  }

  public static async verifyEmailOtp(req: Request, res: Response) {
    try {
      // CONF-07-D: IP-based rate limiting on OTP verification attempts
      const clientIp = getClientIp(req);
      const ipLimit = await AuthService.checkRateLimit(`verify_ip_${clientIp}`, 30, 900);
      if (!ipLimit.allowed) {
        if (ipLimit.isServiceUnavailable) {
          return res.status(503).json({
            success: false,
            error: 'Verification service temporarily unavailable. Please try again later.'
          });
        }
        if (typeof res.set === 'function') {
          res.set('Retry-After', String(ipLimit.retryAfterSeconds));
        }
        return res.status(429).json({
          success: false,
          error: 'Too many verification attempts from this IP. Please try again later.'
        });
      }

      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({
          success: false,
          error: 'Email and OTP are required.'
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedOtp = String(otp).trim();

      if (!/^\d{6}$/.test(normalizedOtp)) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid 6-digit OTP.'
        });
      }

      // Execute atomic OTP verification, single-use consumption, and account creation inside a transaction
      const txResult = await withTransaction(async (tx) => {
        // Revalidate the OTP record inside the transaction
        const verificationResult = await tx.query(
          `SELECT *
           FROM email_verifications
           WHERE email = $1
           LIMIT 1`,
          [normalizedEmail]
        );

        // CONF-07-F: Standardized response to prevent account/verification enumeration
        if (verificationResult.rows.length === 0) {
          return {
            status: 400,
            error: 'Invalid verification code or code has expired.'
          };
        }

        const verification = verificationResult.rows[0];

        // Reject expired verification
        if (new Date(verification.expires_at).getTime() < Date.now()) {
          await tx.query(
            'DELETE FROM email_verifications WHERE email = $1',
            [normalizedEmail]
          );

          return {
            status: 400,
            error: 'Invalid verification code or code has expired.'
          };
        }

        // CONF-07-B: Reject if already locked out (5 or more attempts)
        if (verification.attempts >= 5) {
          await tx.query(
            'DELETE FROM email_verifications WHERE email = $1',
            [normalizedEmail]
          );

          return {
            status: 429,
            error: 'Too many invalid attempts. Verification code has been invalidated. Please register again.'
          };
        }

        // CONF-07-C: Verify candidate OTP against stored HMAC-SHA256 hash or legacy plaintext
        const isMatch = AuthService.verifyOtpHash(
          normalizedOtp,
          normalizedEmail,
          verification.otp_hash,
          verification.otp
        );

        if (!isMatch) {
          // CONF-07-B: Atomically increment failed attempts
          const updateRes = await tx.query<{ attempts: number }>(
            `UPDATE email_verifications
             SET attempts = attempts + 1
             WHERE email = $1
               AND attempts < 5
             RETURNING attempts`,
            [normalizedEmail]
          );

          const currentAttempts = updateRes.rows[0]?.attempts ?? 5;

          if (currentAttempts >= 5) {
            await tx.query(
              'DELETE FROM email_verifications WHERE email = $1',
              [normalizedEmail]
            );

            return {
              status: 429,
              error: 'Too many invalid attempts. Verification code has been invalidated. Please register again.'
            };
          }

          return {
            status: 400,
            error: 'Invalid verification code or code has expired.'
          };
        }

        // Check if user already exists
        const existingUser = await tx.query(
          'SELECT id FROM users WHERE LOWER(email) = $1 OR mobile = $2 LIMIT 1',
          [normalizedEmail, verification.mobile]
        );

        if (existingUser.rows.length > 0) {
          return {
            status: 400,
            error: 'Invalid verification code or code has expired.'
          };
        }

        // CONF-07-B: Atomically consume verification code exactly once inside transaction
        const deleteResult = await tx.query(
          `DELETE FROM email_verifications
           WHERE email = $1
             AND attempts < 5
             AND expires_at > CURRENT_TIMESTAMP
           RETURNING *`,
          [normalizedEmail]
        );

        if (deleteResult.rows.length === 0) {
          return {
            status: 400,
            error: 'Invalid verification code or code has expired.'
          };
        }

        const validVerification = deleteResult.rows[0];

        // Insert new user record inside the transaction
        const userResult = await tx.query(
          `INSERT INTO users (
            name, email, mobile, password_hash, role, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          RETURNING id, name, email, mobile, role`,
          [
            validVerification.name,
            normalizedEmail,
            validVerification.mobile,
            validVerification.password_hash,
            validVerification.role
          ]
        );

        const newUser = userResult.rows[0];

        // For drivers, create associated driver record in that same transaction
        if (validVerification.role === 'driver') {
          await tx.query(
            `INSERT INTO drivers (
              user_id, auto_number, auto_model, license_number,
              availability_status, approval_status,
              payout_upi, payout_bank_account, payout_ifsc,
              created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, 'available', 'PENDING', $5, $6, $7,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
              newUser.id,
              validVerification.auto_number,
              validVerification.auto_model || 'Bajaj Compact 4S',
              validVerification.license_number || 'DL-AUTO-2024-8899',
              validVerification.payout_upi || null,
              validVerification.payout_bank_account || null,
              validVerification.payout_ifsc || null
            ]
          );
        }

        return {
          status: 201,
          user: newUser,
          role: validVerification.role
        };
      });

      if (txResult.error) {
        return res.status(txResult.status || 400).json({
          success: false,
          error: txResult.error
        });
      }

      // Generate JWT only after commit succeeds
      const token = AuthService.generateToken(txResult.user!);

      return res.status(201).json({
        success: true,
        message: txResult.role === 'driver'
          ? 'Email verified. Driver account created and awaiting Owner/Admin approval.'
          : 'Email verified successfully. Account created.',
        data: { user: txResult.user, token }
      });
    } catch (err: any) {
      // Rollback on every failure; never expose SQL errors or sensitive values to clients
      console.error('Email verification error:', err?.message || 'Verification failure');
      return res.status(400).json({
        success: false,
        error: 'Email verification failed.'
      });
    }
  }

  public static async login(req: Request, res: Response) {
    try {
      // CONF-07-D: IP-based rate limiting on login attempts
      const clientIp = getClientIp(req);
      const ipLimit = await AuthService.checkRateLimit(`login_ip_${clientIp}`, 15, 900);
      if (!ipLimit.allowed) {
        if (ipLimit.isServiceUnavailable) {
          return res.status(503).json({
            success: false,
            error: 'Authentication service temporarily unavailable. Please try again later.'
          });
        }
        if (typeof res.set === 'function') {
          res.set('Retry-After', String(ipLimit.retryAfterSeconds));
        }
        return res.status(429).json({
          success: false,
          error: 'Too many login attempts from this IP. Please try again later.'
        });
      }

      const { identifier, password } = req.body;
      const cleanIdentifier = typeof identifier === 'string' ? identifier.trim().toLowerCase() : '';

      // Account-level brute-force protection (5 attempts per 15 minutes)
      // SHA-256 digest prevents sensitive identifier exposure in rate-limit storage
      if (cleanIdentifier) {
        const idHash = crypto.createHash('sha256').update(cleanIdentifier).digest('hex').slice(0, 32);
        const accLimit = await AuthService.checkRateLimit(`login_acc_${idHash}`, 5, 900);
        if (!accLimit.allowed) {
          if (accLimit.isServiceUnavailable) {
            return res.status(503).json({
              success: false,
              error: 'Authentication service temporarily unavailable. Please try again later.'
            });
          }
          if (typeof res.set === 'function') {
            res.set('Retry-After', String(accLimit.retryAfterSeconds));
          }
          return res.status(429).json({
            success: false,
            error: 'Too many failed login attempts for this account. Please try again later.'
          });
        }
      }

      const result = await AuthService.login(identifier, password);

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: result
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 401;
      if (err.retryAfterSeconds && typeof res.set === 'function') {
        res.set('Retry-After', String(err.retryAfterSeconds));
      }
      return res.status(statusCode).json({ success: false, error: err.message || 'Login failed.' });
    }
  }

  public static async getMe(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
      }
      const user = await AuthService.getUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found.' });
      }
      return res.json({ success: true, data: user });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async acceptTerms(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
      }
      const version = String(req.body.version || '1.0').trim();
      const now = new Date();
      await query(
        `UPDATE users
         SET terms_version = $1, terms_accepted_at = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [version, now, req.user.id]
      );

      const updatedUser = await AuthService.getUserById(req.user.id);
      return res.json({
        success: true,
        message: 'Terms of service accepted successfully.',
        data: updatedUser
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async logout(req: Request, res: Response) {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

      if (token) {
        await AuthService.revokeToken(token);
      }

      return res.json({ success: true, message: 'Logged out successfully.' });
    } catch (err: any) {
      // Logout must be idempotent and resilient: always return success to the client
      console.error('[Auth] Error during token revocation on logout:', err?.message || err);
      return res.json({ success: true, message: 'Logged out successfully.' });
    }
  }

  public static async changePassword(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
      }

      // Rate limit password change attempts per user and IP (10 attempts per 15 minutes)
      const clientIp = getClientIp(req);
      const rateLimitKey = `pwd_change_${req.user.id}_${clientIp}`;
      const rateLimit = await AuthService.checkRateLimit(rateLimitKey, 10, 900);
      if (!rateLimit.allowed) {
        if (typeof res.set === 'function') {
          res.set('Retry-After', String(rateLimit.retryAfterSeconds));
        }
        return res.status(429).json({
          success: false,
          error: 'Too many password change attempts. Please try again later.'
        });
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      await AuthService.changePassword(
        req.user.id,
        currentPassword,
        newPassword,
        confirmPassword
      );

      // Invalidate current Bearer token in revoked_tokens
      const authHeader = req.headers['authorization'];
      const currentToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
      if (currentToken) {
        await AuthService.revokeToken(currentToken);
      }

      // If account is an admin, record audit log in admin_audit_logs
      // Password, hash, or tokens must NEVER be logged or stored in audit details!
      if (req.user.role === 'admin') {
        try {
          await AuditService.logAction({
            adminId: req.user.id,
            adminEmail: req.user.email,
            action: 'CHANGE_PASSWORD',
            targetType: 'USER',
            targetId: req.user.id,
            details: { success: true },
            clientIp
          });
        } catch (auditErr: any) {
          console.error('[Audit] Failed to log admin change password action:', auditErr?.message || auditErr);
        }
      }

      return res.json({
        success: true,
        message: 'Password changed successfully. Please log in again with your new password.'
      });
    } catch (err: any) {
      const statusCode = err.statusCode || 500;
      const errorMessage = statusCode === 500
        ? 'Failed to change password. Please try again.'
        : (err.message || 'Failed to change password.');
      return res.status(statusCode).json({
        success: false,
        error: errorMessage
      });
    }
  }

  public static async getDeletionRequest(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
      }

      const result = await query(
        `SELECT id, user_id, user_role, reason, status, requested_at, processed_at
         FROM account_deletion_requests
         WHERE user_id = $1
         ORDER BY requested_at DESC
         LIMIT 1`,
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.json({
          success: true,
          data: {
            hasPendingRequest: false,
            request: null
          }
        });
      }

      const row = result.rows[0];
      return res.json({
        success: true,
        data: {
          hasPendingRequest: row.status === 'PENDING',
          request: row
        }
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Failed to fetch deletion status.' });
    }
  }

  public static async requestAccountDeletion(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
      }

      const userId = req.user.id;
      const userRole = req.user.role;

      // Check active rides in progress
      if (userRole === 'customer') {
        const activeRideRes = await query(
          `SELECT id, booking_reference, status
           FROM bookings
           WHERE customer_id = $1
             AND status IN ('Searching for Auto', 'Driver Assigned', 'Driver Arriving', 'Ride Started')
           LIMIT 1`,
          [userId]
        );
        if (activeRideRes.rows.length > 0) {
          const ride = activeRideRes.rows[0];
          return res.status(400).json({
            success: false,
            error: `Cannot request account deletion while you have an active ride in progress (${ride.booking_reference} - ${ride.status}). Please complete or cancel your ride first.`
          });
        }

        const activeTripRes = await query(
          `SELECT id, booking_reference, status
           FROM trip_bookings
           WHERE customer_id = $1
             AND status IN ('NEW', 'CONTACTED', 'CONFIRMED')
           LIMIT 1`,
          [userId]
        );
        if (activeTripRes.rows.length > 0) {
          const trip = activeTripRes.rows[0];
          return res.status(400).json({
            success: false,
            error: `Cannot request account deletion while you have an active outstation trip booking (${trip.booking_reference} - ${trip.status}). Please complete or cancel your trip first.`
          });
        }
      } else if (userRole === 'driver') {
        const activeDriverRideRes = await query(
          `SELECT b.id, b.booking_reference, b.status
           FROM bookings b
           JOIN drivers d ON d.id = b.driver_id
           WHERE d.user_id = $1
             AND b.status IN ('Driver Assigned', 'Driver Arriving', 'Ride Started')
           LIMIT 1`,
          [userId]
        );
        if (activeDriverRideRes.rows.length > 0) {
          const ride = activeDriverRideRes.rows[0];
          return res.status(400).json({
            success: false,
            error: `Cannot request account deletion while you have an active ride assigned (${ride.booking_reference} - ${ride.status}). Please complete or cancel your ride first.`
          });
        }
      }

      // Check if an existing pending request is already under review
      const existingRequest = await query(
        `SELECT id, status, requested_at
         FROM account_deletion_requests
         WHERE user_id = $1 AND status = 'PENDING'
         LIMIT 1`,
        [userId]
      );
      if (existingRequest.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'An account deletion request is already pending review for this account. For questions or assistance, please contact support@clik2go.in.'
        });
      }

      // Fetch user email and mobile for record integrity
      const userRecord = await query(
        `SELECT email, mobile FROM users WHERE id = $1 LIMIT 1`,
        [userId]
      );
      const email = userRecord.rows[0]?.email || req.user.email || '';
      const mobile = userRecord.rows[0]?.mobile || req.user.mobile || '';

      const reason = req.body.reason ? String(req.body.reason).trim().slice(0, 500) : null;

      // Insert deletion request
      const insertResult = await query(
        `INSERT INTO account_deletion_requests (
           user_id, user_role, user_email, user_mobile, reason, status, requested_at
         )
         VALUES ($1, $2, $3, $4, $5, 'PENDING', CURRENT_TIMESTAMP)
         RETURNING id, user_id, user_role, reason, status, requested_at`,
        [userId, userRole, email, mobile, reason]
      );

      // If driver, automatically set availability to offline
      if (userRole === 'driver') {
        await query(
          `UPDATE drivers
           SET availability_status = 'offline'
           WHERE user_id = $1`,
          [userId]
        );
      }

      // Flag deletion requested on users table
      await query(
        `UPDATE users
         SET deletion_requested_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [userId]
      );

      return res.status(201).json({
        success: true,
        message: 'Your account deletion request has been submitted successfully. In accordance with statutory requirements, financial and ride transaction records are archived for legal compliance. For questions, contact support@clik2go.in.',
        data: insertResult.rows[0]
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Failed to submit deletion request.' });
    }
  }

  public static async cancelAccountDeletion(req: Request, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Not authenticated.' });
      }

      const userId = req.user.id;

      const deleteResult = await query(
        `DELETE FROM account_deletion_requests
         WHERE user_id = $1 AND status = 'PENDING'
         RETURNING id`,
        [userId]
      );

      if (deleteResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'No pending account deletion request found to cancel.'
        });
      }

      await query(
        `UPDATE users
         SET deletion_requested_at = NULL
         WHERE id = $1`,
        [userId]
      );

      return res.json({
        success: true,
        message: 'Your account deletion request has been cancelled. Your account remains active.'
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message || 'Failed to cancel deletion request.' });
    }
  }
}
