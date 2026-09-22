import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

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
