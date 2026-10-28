import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { AuthUser, JWT_SECRET } from '../middleware/auth';
import { EmailService } from './emailService';

export class AuthService {
  public static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  public static generateToken(user: AuthUser): string {
    return jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        terms_version: user.terms_version || null
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
  private static generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
public static async login(
  identifier: string,
  password: string
): Promise<{ user: AuthUser; token: string }> {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  const result = await query(
    `SELECT id, name, email, mobile, password_hash, role, terms_version, terms_accepted_at,
            COALESCE(status, 'ACTIVE') as status
     FROM users
     WHERE LOWER(email) = $1 OR mobile = $2
     LIMIT 1`,
    [normalizedIdentifier, identifier.trim()]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid email/mobile or password.');
  }

  const row = result.rows[0];

  if (row.status === 'DEACTIVATED') {
    throw new Error('This account has been deactivated. For inquiries or reactivation, please contact support@clik2go.in.');
  }

  const isValid = await this.comparePassword(password, row.password_hash);

  if (!isValid) {
    throw new Error('Invalid email/mobile or password.');
  }

  const user: AuthUser = {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    role: row.role,
    terms_version: row.terms_version || null,
    terms_accepted_at: row.terms_accepted_at ? new Date(row.terms_accepted_at).toISOString() : null,
    status: row.status
  };

  return {
    user,
    token: this.generateToken(user)
  };
}

public static async getUserById(id: number): Promise<AuthUser | null> {
  const result = await query(
    `SELECT id, name, email, mobile, role, terms_version, terms_accepted_at,
            COALESCE(status, 'ACTIVE') as status
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  if (row.status === 'DEACTIVATED') {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    mobile: row.mobile,
    role: row.role,
    terms_version: row.terms_version || null,
    terms_accepted_at: row.terms_accepted_at ? new Date(row.terms_accepted_at).toISOString() : null,
    status: row.status
  };
}

  public static async register(data: {
    name: string;
    email: string;
    mobile: string;
    password: string;
    role?: 'customer' | 'driver' | 'admin';
    autoNumber?: string;
    autoModel?: string;
    licenseNumber?: string;
    payoutUpi?: string;
    payoutBankAccount?: string;
    payoutIfsc?: string;
  }): Promise<{ requiresVerification: true; email: string }> {
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const mobile = data.mobile.trim().replace(/\s+/g, '');
    const requestedRole = data.role || 'customer';

    if (requestedRole === 'admin') {
      throw new Error('Public owner/admin registration is disallowed.');
    }

    const role = requestedRole === 'driver' ? 'driver' : 'customer';

    if (!name) throw new Error('Full name is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please provide a valid email address.');
    }
    if (!mobile || !/^\+?[0-9]{10,14}$/.test(mobile)) {
      throw new Error('Please provide a valid mobile number.');
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (role === 'driver') {
      if (!data.autoNumber?.trim()) {
        throw new Error('Auto registration number is required for drivers.');
      }
      if (!data.payoutUpi?.trim() && !data.payoutBankAccount?.trim()) {
        throw new Error('Please provide a UPI ID or bank account.');
      }
    }

    const emailCheck = await query(
      'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );
    if (emailCheck.rows.length > 0) {
      throw new Error('An account with this email address already exists.');
    }

    const mobileCheck = await query(
      'SELECT id FROM users WHERE mobile = $1 LIMIT 1',
      [mobile]
    );
    if (mobileCheck.rows.length > 0) {
      throw new Error('An account with this mobile number already exists.');
    }

    const passwordHash = await this.hashPassword(data.password);
    const otp = this.generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      `INSERT INTO email_verifications (
        email, name, mobile, password_hash, role, otp, expires_at,
        auto_number, auto_model, license_number,
        payout_upi, payout_bank_account, payout_ifsc, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        mobile = EXCLUDED.mobile,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        otp = EXCLUDED.otp,
        expires_at = EXCLUDED.expires_at,
        auto_number = EXCLUDED.auto_number,
        auto_model = EXCLUDED.auto_model,
        license_number = EXCLUDED.license_number,
        payout_upi = EXCLUDED.payout_upi,
        payout_bank_account = EXCLUDED.payout_bank_account,
        payout_ifsc = EXCLUDED.payout_ifsc,
        created_at = CURRENT_TIMESTAMP`,
      [
        email, name, mobile, passwordHash, role, otp, expiresAt,
        role === 'driver' ? data.autoNumber!.trim().toUpperCase() : null,
        role === 'driver' ? data.autoModel?.trim() || 'Bajaj Compact 4S' : null,
        role === 'driver'
          ? data.licenseNumber?.trim() || ('DL-AUTO-' + Math.floor(100000 + Math.random() * 900000))
          : null,
        role === 'driver' ? data.payoutUpi?.trim() || null : null,
        role === 'driver' ? data.payoutBankAccount?.trim() || null : null,
        role === 'driver' ? data.payoutIfsc?.trim().toUpperCase() || null : null
      ]
    );

    try {
      await EmailService.sendVerificationOtp(email, otp);
    } catch (error) {
      await query('DELETE FROM email_verifications WHERE email = $1', [email]);
      throw error;
    }

    return { requiresVerification: true, email };
  }
}