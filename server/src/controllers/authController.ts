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

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtp = String(otp).trim();

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
        error: 'No pending email verification found.'
      });
    }

    const verification = verificationResult.rows[0];

    if (new Date(verification.expires_at).getTime() < Date.now()) {
      await query(
        `DELETE FROM email_verifications WHERE email = $1`,
        [normalizedEmail]
      );

      return res.status(400).json({
        success: false,
        error: 'OTP has expired. Please register again.'
      });
    }

    if (verification.otp !== normalizedOtp) {
      return res.status(400).json({
        success: false,
        error: 'Invalid OTP.'
      });
    }

    const userResult = await query(
      `INSERT INTO users (
        name,
        email,
        mobile,
        password_hash,
        role,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, name, email, mobile, role`,
      [
        verification.name,
        verification.email,
        verification.mobile,
        verification.password_hash,
        verification.role
      ]
    );

    const newUser = userResult.rows[0];

    await query(
      `DELETE FROM email_verifications WHERE email = $1`,
      [normalizedEmail]
    );

    const token = AuthService.generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'Email verified successfully. Account created.',
      data: {
        user: newUser,
        token
      }
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

  public static async logout(req: Request, res: Response) {
    return res.json({ success: true, message: 'Logged out successfully.' });
  }
}
