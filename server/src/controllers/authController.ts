import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { query } from '../config/db';

export class AuthController {
  public static async register(req: Request, res: Response) {
    try {
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
        message: role === 'driver' 
          ? 'Driver account registered successfully. Your profile is pending Owner/Admin verification.'
          : 'Account created successfully.',
        data: result
      });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message || 'Registration failed.' });
    }
  }
  public static async verifyEmailOtp(req: Request, res: Response) {
    try {
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

      const verificationResult = await query(
        `SELECT *
         FROM email_verifications
         WHERE email = $1
         LIMIT 1`,
        [normalizedEmail]
      );

      if (verificationResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No pending email verification found. Please register again.'
        });
      }

      const verification = verificationResult.rows[0];

      if (new Date(verification.expires_at).getTime() < Date.now()) {
        await query(
          'DELETE FROM email_verifications WHERE email = $1',
          [normalizedEmail]
        );

        return res.status(400).json({
          success: false,
          error: 'OTP expired. Please register again.'
        });
      }

      if (verification.otp !== normalizedOtp) {
        return res.status(400).json({
          success: false,
          error: 'Invalid OTP.'
        });
      }

      const existingUser = await query(
        'SELECT id FROM users WHERE LOWER(email) = $1 OR mobile = $2 LIMIT 1',
        [normalizedEmail, verification.mobile]
      );

      if (existingUser.rows.length > 0) {
        await query(
          'DELETE FROM email_verifications WHERE email = $1',
          [normalizedEmail]
        );

        return res.status(409).json({
          success: false,
          error: 'An account with this email or mobile number already exists.'
        });
      }

      const userResult = await query(
        `INSERT INTO users (
          name, email, mobile, password_hash, role, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, name, email, mobile, role`,
        [
          verification.name,
          normalizedEmail,
          verification.mobile,
          verification.password_hash,
          verification.role
        ]
      );

      const newUser = userResult.rows[0];

      if (verification.role === 'driver') {
        await query(
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
            verification.auto_number,
            verification.auto_model || 'Bajaj Compact 4S',
            verification.license_number || 'DL-AUTO-2024-8899',
            verification.payout_upi || null,
            verification.payout_bank_account || null,
            verification.payout_ifsc || null
          ]
        );
      }

      await query(
        'DELETE FROM email_verifications WHERE email = $1',
        [normalizedEmail]
      );

      const token = AuthService.generateToken(newUser);

      return res.status(201).json({
        success: true,
        message: verification.role === 'driver'
          ? 'Email verified. Driver account created and awaiting Owner/Admin approval.'
          : 'Email verified successfully. Account created.',
        data: { user: newUser, token }
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message || 'Email verification failed.'
      });
    }
  }
  public static async login(req: Request, res: Response) {
    try {
      const { identifier, password } = req.body;
      const result = await AuthService.login(identifier, password);

      return res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: result
      });
    } catch (err: any) {
      return res.status(401).json({ success: false, error: err.message || 'Login failed.' });
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
    return res.json({ success: true, message: 'Logged out successfully.' });
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
