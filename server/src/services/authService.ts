import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { AuthUser, JWT_SECRET } from '../middleware/auth';

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
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
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
  }): Promise<{ user: AuthUser; token: string }> {
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const mobile = data.mobile.trim().replace(/\s+/g, '');
    const requestedRole = data.role || 'customer';

    // Prevent public admin registration
    if (requestedRole === 'admin') {
      throw new Error('Public owner/admin registration is disallowed. Please use designated admin credentials.');
    }

    const role = requestedRole === 'driver' ? 'driver' : 'customer';

    // Validation
    if (!name) throw new Error('Full name is required.');
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('Please provide a valid email address.');
    }
    if (!mobile || !/^\+?[0-9]{10,14}$/.test(mobile)) {
      throw new Error('Please provide a valid 10-digit mobile number.');
    }
    if (!data.password || data.password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (role === 'driver') {
      if (!data.autoNumber || !data.autoNumber.trim()) {
        throw new Error('Auto registration number is required for drivers.');
      }
      if (!data.payoutUpi && !data.payoutBankAccount) {
        throw new Error('Please provide at least one payout method (UPI ID or Bank Account).');
      }
    }

    // Check duplicate email
    const emailCheck = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (emailCheck.rows.length > 0) {
      throw new Error('An account with this email address already exists.');
    }

    // Check duplicate mobile
    const mobileCheck = await query('SELECT id FROM users WHERE mobile = $1 LIMIT 1', [mobile]);
    if (mobileCheck.rows.length > 0) {
      throw new Error('An account with this mobile number already exists.');
    }

    const passwordHash = await this.hashPassword(data.password);

    const userResult = await query(
      `INSERT INTO users (name, email, mobile, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, name, email, mobile, role`,
      [name, email, mobile, passwordHash, role]
    );

    const newUser: AuthUser = userResult.rows[0];

    // If registering as driver, create driver record with approval_status = 'PENDING'
    if (role === 'driver') {
      await query(
        `INSERT INTO drivers (
          user_id, auto_number, auto_model, license_number, availability_status, approval_status,
          payout_upi, payout_bank_account, payout_ifsc, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'available', 'PENDING', $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          newUser.id,
          data.autoNumber!.trim().toUpperCase(),
          data.autoModel?.trim() || 'Bajaj Compact 4S',
          data.licenseNumber?.trim() || ('DL-AUTO-' + Math.floor(100000 + Math.random() * 900000)),
          data.payoutUpi?.trim() || null,
          data.payoutBankAccount?.trim() || null,
          data.payoutIfsc?.trim().toUpperCase() || null
        ]
      );
    }

    const token = this.generateToken(newUser);
    return { user: newUser, token };
  }

  public static async login(identifier: string, password: string): Promise<{ user: AuthUser; token: string }> {
    const rawId = (identifier || '').trim();
    if (!rawId || !password) {
      throw new Error('Please provide both email/mobile and password.');
    }

    const isEmail = rawId.includes('@');
    const lookupField = isEmail ? 'email' : 'mobile';
    const lookupValue = isEmail ? rawId.toLowerCase() : rawId.replace(/\s+/g, '');

    const res = await query(
      `SELECT id, name, email, mobile, password_hash, role FROM users WHERE ${lookupField} = $1 LIMIT 1`,
      [lookupValue]
    );

    if (res.rows.length === 0) {
      throw new Error('Invalid email/mobile or password.');
    }

    const userRow = res.rows[0];
    const isMatch = await this.comparePassword(password, userRow.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email/mobile or password.');
    }

    const user: AuthUser = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      mobile: userRow.mobile,
      role: userRow.role
    };

    const token = this.generateToken(user);
    return { user, token };
  }

  public static async getUserById(id: number): Promise<AuthUser | null> {
    const res = await query(
      'SELECT id, name, email, mobile, role FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }
}
