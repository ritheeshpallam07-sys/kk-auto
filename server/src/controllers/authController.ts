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
}
