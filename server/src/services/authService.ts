import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, DbTransactionClient } from '../config/db';
import { AuthUser, JWT_SECRET, JWT_ALGORITHM, getJwtSecret } from '../middleware/auth';
import { EmailService } from './emailService';

export class AsyncMutex {
  private queue: Array<() => void> = [];
  private locked = false;

  public async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => {
        this.locked = true;
        resolve(() => this.release());
      });
    });
  }

  public async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  isServiceUnavailable?: boolean;
}

export class AuthService {
  public static readonly adminDeactivationMutex = new AsyncMutex();

  /**
   * Count the number of currently active administrator accounts.
   */
  public static async countActiveAdmins(txClient?: DbTransactionClient): Promise<number> {
    const db = txClient || { query };
    const res = await db.query(
      `SELECT COUNT(*) as count
       FROM users
       WHERE LOWER(role) = 'admin'
         AND UPPER(COALESCE(status, 'ACTIVE')) != 'DEACTIVATED'`
    );
    return parseInt(res.rows[0].count, 10);
  }

  /**
   * Asserts that deactivating the given administrator account will not leave
   * the platform without any active administrators.
   * Locks all active admin rows with FOR UPDATE to serialize concurrent deactivations.
   */
  public static async assertNotLastActiveAdmin(userId: number, txClient: DbTransactionClient): Promise<void> {
    const activeAdminsRes = await txClient.query(
      `SELECT id, email, role, COALESCE(status, 'ACTIVE') as status
       FROM users
       WHERE LOWER(role) = 'admin'
         AND UPPER(COALESCE(status, 'ACTIVE')) != 'DEACTIVATED'
       FOR UPDATE`
    );

    const otherActiveAdmins = activeAdminsRes.rows.filter((u: any) => Number(u.id) !== Number(userId));
    if (otherActiveAdmins.length === 0) {
      const error: any = new Error(
        'Cannot deactivate the last remaining active administrator account. The platform must maintain at least one active administrator.'
      );
      error.statusCode = 400;
      error.code = 'LAST_ACTIVE_ADMIN';
      throw error;
    }
  }
  public static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  public static generateToken(user: AuthUser): string {
    const secret = getJwtSecret();
    const expiresIn = user.role === 'admin' ? '2h' : '7d';
    return jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        terms_version: user.terms_version || null
      },
      secret,
      { expiresIn, algorithm: JWT_ALGORITHM, jwtid: crypto.randomUUID() }
    );
  }

  /**
   * Resolves a unique token identifier for tracking and revocation.
   * Prioritizes standard JWT 'jti' claim; falls back to SHA-256 hash for legacy tokens without jti.
   * Raw JWT is NEVER stored in database or logs.
   */
  public static resolveTokenIdentifier(decoded: any, rawToken: string): string {
    if (decoded && decoded.jti && typeof decoded.jti === 'string') {
      return decoded.jti;
    }
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Revokes a specific JWT token on logout.
   * Decodes/verifies the token, calculates expiry, and persists the token identifier.
   * Idempotent: repeated calls for the same token succeed without error.
   * Never stores the raw JWT in the database.
   */
  public static async revokeToken(token: string): Promise<boolean> {
    try {
      if (!token || typeof token !== 'string') {
        return false;
      }

      const secret = getJwtSecret();
      // Verify signature using pinned algorithm; ignoreExpiration ensures tokens close to or past expiry can still be revoked
      const decoded = jwt.verify(token, secret, {
        algorithms: [JWT_ALGORITHM],
        ignoreExpiration: true
      }) as any;

      if (!decoded || !decoded.id) {
        return false;
      }

      const tokenIdentifier = this.resolveTokenIdentifier(decoded, token);
      const expiresAt = decoded.exp
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await query(
        `INSERT INTO revoked_tokens (token_identifier, user_id, expires_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (token_identifier) DO NOTHING`,
        [tokenIdentifier, decoded.id, expiresAt]
      );

      return true;
    } catch (err: any) {
      // Invalid signature or unparseable token: cannot be authenticated anyway
      return false;
    }
  }

  /**
   * Cleans up expired revoked tokens from the database.
   * Safely removes records where expires_at < CURRENT_TIMESTAMP.
   * Active revoked tokens are retained until their natural expiration.
   */
  public static async cleanExpiredRevokedTokens(): Promise<number> {
    try {
      const result = await query(
        `DELETE FROM revoked_tokens
         WHERE expires_at < CURRENT_TIMESTAMP
         RETURNING token_identifier`
      );
      return result.rowCount ?? result.rows.length;
    } catch (err: any) {
      console.error('Revoked tokens cleanup failed:', err?.message || 'Database error');
      return 0;
    }
  }

  /**
   * Cryptographically secure 6-digit OTP generation using Node.js crypto.randomInt (CONF-07-A)
   */
  public static generateOtp(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Keyed HMAC-SHA256 OTP hashing using server-side secret (CONF-07-C)
   */
  public static hashOtp(otp: string, email: string): string {
    const secret = process.env.OTP_SECRET || getJwtSecret();
    return crypto
      .createHmac('sha256', secret)
      .update(`${email.trim().toLowerCase()}:${otp.trim()}`)
      .digest('hex');
  }

  /**
   * Timing-safe OTP hash comparison with backward-compatibility for legacy records (CONF-07-C)
   */
  public static verifyOtpHash(
    candidateOtp: string,
    email: string,
    storedHash?: string | null,
    legacyPlaintextOtp?: string | null
  ): boolean {
    const normOtp = String(candidateOtp || '').trim();
    const normEmail = String(email || '').trim().toLowerCase();

    if (!/^\d{6}$/.test(normOtp)) {
      return false;
    }

    if (storedHash) {
      const candidateHash = this.hashOtp(normOtp, normEmail);
      const bufA = Buffer.from(candidateHash, 'hex');
      const bufB = Buffer.from(storedHash, 'hex');
      if (bufA.length !== bufB.length) {
        return false;
      }
      return crypto.timingSafeEqual(bufA, bufB);
    }

    // Backward-compatibility: verify against legacy plaintext OTP if storedHash is null
    if (legacyPlaintextOtp && legacyPlaintextOtp !== '******') {
      const bufA = Buffer.from(normOtp, 'utf8');
      const bufB = Buffer.from(legacyPlaintextOtp, 'utf8');
      if (bufA.length !== bufB.length) {
        return false;
      }
      return crypto.timingSafeEqual(bufA, bufB);
    }

    return false;
  }

  /**
   * Persistent shared rate limiter in PostgreSQL (CONF-07-D)
   */
  public static async checkRateLimit(
    key: string,
    maxPoints: number,
    windowSeconds: number
  ): Promise<RateLimitResult> {
    try {
      const expireAt = new Date(Date.now() + windowSeconds * 1000);
      const res = await query<{ points: number; ttl: number }>(
        `INSERT INTO rate_limits (key, points, expire_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (key) DO UPDATE
         SET points = CASE
           WHEN rate_limits.expire_at <= CURRENT_TIMESTAMP THEN 1
           ELSE rate_limits.points + 1
         END,
         expire_at = CASE
           WHEN rate_limits.expire_at <= CURRENT_TIMESTAMP THEN $2
           ELSE rate_limits.expire_at
         END
         RETURNING points, GREATEST(1, EXTRACT(EPOCH FROM (expire_at - CURRENT_TIMESTAMP))::INTEGER) as ttl`,
        [key, expireAt]
      );

      const row = res.rows[0];
      const points = row ? Number(row.points) : 1;
      const ttl = row ? Number(row.ttl) : windowSeconds;

      if (points > maxPoints) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: ttl
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, maxPoints - points),
        retryAfterSeconds: 0
      };
    } catch (err: any) {
      // Security: Do NOT log key, IP addresses, secrets, or sensitive request data
      console.error('Rate limit persistent store unavailable:', err?.message || 'Database error');
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: 0,
        isServiceUnavailable: true
      };
    }
  }

  /**
   * Bounded batch cleanup of expired rate limit entries (CONF-07 Reliability).
   * Safely deletes expired rows without long database locks.
   * Does not affect active rate limits.
   */
  public static async cleanupExpiredRateLimits(batchSize: number = 1000): Promise<number> {
    try {
      const safeBatchSize = Math.max(1, Math.min(batchSize, 10000));
      const result = await query(
        `DELETE FROM rate_limits
         WHERE key IN (
           SELECT key
           FROM rate_limits
           WHERE expire_at < CURRENT_TIMESTAMP
           LIMIT $1
         )
         RETURNING key`,
        [safeBatchSize]
      );
      return result.rowCount ?? result.rows.length;
    } catch (err: any) {
      console.error('Rate limit cleanup failed:', err?.message || 'Database error');
      return 0;
    }
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

    // CONF-07-F: Check if user already exists in users table.
    // If account exists, return standard verification prompt without disclosing account existence.
    const userCheck = await query(
      'SELECT id FROM users WHERE LOWER(email) = $1 OR mobile = $2 LIMIT 1',
      [email, mobile]
    );
    if (userCheck.rows.length > 0) {
      return { requiresVerification: true, email };
    }

    // CONF-07-D & CONF-07-E: Check existing pending verification record
    const pendingCheck = await query(
      'SELECT * FROM email_verifications WHERE email = $1 LIMIT 1',
      [email]
    );

    if (pendingCheck.rows.length > 0) {
      const existing = pendingCheck.rows[0];
      const isUnexpired = new Date(existing.expires_at).getTime() > Date.now();

      if (isUnexpired) {
        // Enforce 60-second cooldown between OTP sends for the same email
        const lastSent = new Date(existing.last_sent_at || existing.created_at).getTime();
        const elapsedMs = Date.now() - lastSent;
        if (elapsedMs < 60_000) {
          const retrySec = Math.max(1, Math.ceil((60_000 - elapsedMs) / 1000));
          const err: any = new Error(`Please wait ${retrySec} seconds before requesting another verification code.`);
          err.statusCode = 429;
          err.retryAfterSeconds = retrySec;
          throw err;
        }

        // CONF-07-E: Legitimate resend for active pending verification.
        // Refresh OTP hash, expiry, reset attempts, and update last_sent_at.
        // STRICTLY PRESERVE original pending credentials (password_hash, mobile, name, payout details).
        const newOtp = this.generateOtp();
        const newHash = this.hashOtp(newOtp, email);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await query(
          `UPDATE email_verifications
           SET otp_hash = $1,
               otp = NULL,
               expires_at = $2,
               attempts = 0,
               last_sent_at = CURRENT_TIMESTAMP
           WHERE email = $3`,
          [newHash, expiresAt, email]
        );

        await EmailService.sendVerificationOtp(email, newOtp);
        return { requiresVerification: true, email };
      }
    }

    // Initial registration or previous verification has expired: create fresh verification
    const passwordHash = await this.hashPassword(data.password);
    const otp = this.generateOtp();
    const otpHmac = this.hashOtp(otp, email);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const isInitial = pendingCheck.rows.length === 0;

    await query(
      `INSERT INTO email_verifications (
        email, name, mobile, password_hash, role, otp_hash, otp, expires_at,
        auto_number, auto_model, license_number,
        payout_upi, payout_bank_account, payout_ifsc,
        attempts, last_sent_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8, $9, $10, $11, $12, $13, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE SET
        name = EXCLUDED.name,
        mobile = EXCLUDED.mobile,
        password_hash = EXCLUDED.password_hash,
        role = EXCLUDED.role,
        otp_hash = EXCLUDED.otp_hash,
        otp = NULL,
        expires_at = EXCLUDED.expires_at,
        auto_number = EXCLUDED.auto_number,
        auto_model = EXCLUDED.auto_model,
        license_number = EXCLUDED.license_number,
        payout_upi = EXCLUDED.payout_upi,
        payout_bank_account = EXCLUDED.payout_bank_account,
        payout_ifsc = EXCLUDED.payout_ifsc,
        attempts = 0,
        last_sent_at = CURRENT_TIMESTAMP,
        created_at = CURRENT_TIMESTAMP`,
      [
        email,
        name,
        mobile,
        passwordHash,
        role,
        otpHmac,
        expiresAt,
        role === 'driver' ? data.autoNumber!.trim().toUpperCase() : null,
        role === 'driver' ? data.autoModel?.trim() || 'Bajaj Compact 4S' : null,
        role === 'driver'
          ? data.licenseNumber?.trim() || ('DL-AUTO-' + crypto.randomInt(100000, 1000000))
          : null,
        role === 'driver' ? data.payoutUpi?.trim() || null : null,
        role === 'driver' ? data.payoutBankAccount?.trim() || null : null,
        role === 'driver' ? data.payoutIfsc?.trim().toUpperCase() || null : null
      ]
    );

    try {
      await EmailService.sendVerificationOtp(email, otp);
    } catch (error) {
      if (isInitial) {
        await query('DELETE FROM email_verifications WHERE email = $1', [email]);
      }
      throw error;
    }

    return { requiresVerification: true, email };
  }
}
