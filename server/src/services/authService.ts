import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, withTransaction, DbTransactionClient } from '../config/db';
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

  // Pre-computed standard cost-10 bcrypt hash used to equalize timing for non-existent accounts (SEC-02)
  public static readonly DUMMY_BCRYPT_HASH = '$2a$10$wN2L5x7B8yZ1v4c9k0m3e.uH2pG7rT2sX5Vw6tJ6y6hB.0j7oK2q';

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
        terms_version: user.terms_version || null,
        token_version: user.token_version || 1
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

  /**
   * Resets or clears rate limit entries for a key (SEC-01).
   * Used to reset failed attempt counters upon successful authentication.
   */
  public static async resetRateLimit(key: string): Promise<void> {
    try {
      await query(`DELETE FROM rate_limits WHERE key = $1`, [key]);
    } catch (err: any) {
      console.error('Rate limit reset failed:', err?.message || 'Database error');
    }
  }

  public static async login(
    identifier: string,
    password: string
  ): Promise<{ user: AuthUser; token: string }> {
    // SEC-04: Defensive input validation
    if (
      typeof identifier !== 'string' ||
      typeof password !== 'string' ||
      !identifier.trim() ||
      !password
    ) {
      throw new Error('Invalid email/mobile or password.');
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();

    const result = await query(
      `SELECT id, name, email, mobile, password_hash, role, terms_version, terms_accepted_at,
              COALESCE(status, 'ACTIVE') as status,
              COALESCE(token_version, 1) as token_version
       FROM users
       WHERE LOWER(email) = $1 OR mobile = $2
       LIMIT 1`,
      [normalizedIdentifier, identifier.trim()]
    );

    // SEC-02: Equalize timing with dummy bcrypt comparison for nonexistent users
    if (result.rows.length === 0) {
      await this.comparePassword(password, this.DUMMY_BCRYPT_HASH);
      throw new Error('Invalid email/mobile or password.');
    }

    const row = result.rows[0];

    // SEC-02: Check password BEFORE inspecting account status.
    // Never disclose deactivation state to someone who does not know the valid password!
    const isValid = await this.comparePassword(password, row.password_hash);
    if (!isValid) {
      throw new Error('Invalid email/mobile or password.');
    }

    // After password verification, enforce deactivation policy securely
    if (row.status === 'DEACTIVATED') {
      const deactErr: any = new Error(
        'This account has been deactivated. For inquiries or reactivation, please contact supportclik2go@gmail.com.'
      );
      deactErr.statusCode = 403;
      throw deactErr;
    }

    const user: AuthUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      mobile: row.mobile,
      role: row.role,
      terms_version: row.terms_version || null,
      terms_accepted_at: row.terms_accepted_at ? new Date(row.terms_accepted_at).toISOString() : null,
      status: row.status,
      token_version: Number(row.token_version) || 1
    };

    return {
      user,
      token: this.generateToken(user)
    };
  }

  public static async getUserById(id: number): Promise<AuthUser | null> {
    const result = await query(
      `SELECT id, name, email, mobile, role, terms_version, terms_accepted_at,
              COALESCE(status, 'ACTIVE') as status,
              COALESCE(token_version, 1) as token_version
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
      status: row.status,
      token_version: Number(row.token_version) || 1
    };
  }

  /**
   * Securely changes the user's password.
   * Validates current password, enforces minimum 12-char length, enforces confirmation match,
   * rejects identical password reuse, hashes the new password with bcrypt, updates password_hash,
   * sets password_changed_at = CURRENT_TIMESTAMP, and increments token_version to invalidate previous sessions.
   */
  public static async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; user: AuthUser }> {
    if (!currentPassword || typeof currentPassword !== 'string') {
      const err: any = new Error('Current password is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!newPassword || typeof newPassword !== 'string') {
      const err: any = new Error('New password is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!confirmPassword || typeof confirmPassword !== 'string') {
      const err: any = new Error('Password confirmation is required.');
      err.statusCode = 400;
      throw err;
    }

    if (newPassword.length < 12) {
      const err: any = new Error('New password must be at least 12 characters long.');
      err.statusCode = 400;
      throw err;
    }

    if (newPassword !== confirmPassword) {
      const err: any = new Error('New password and confirmation do not match.');
      err.statusCode = 400;
      throw err;
    }

    // Fetch user with current password hash
    const userRes = await query(
      `SELECT id, name, email, mobile, role, password_hash, status,
              terms_version, terms_accepted_at, COALESCE(token_version, 1) as token_version
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      const err: any = new Error('User account not found.');
      err.statusCode = 404;
      throw err;
    }

    const userRow = userRes.rows[0];

    if (userRow.status === 'DEACTIVATED') {
      const err: any = new Error('This account has been deactivated. Access is denied.');
      err.statusCode = 403;
      throw err;
    }

    // Verify current password
    const isCurrentValid = await this.comparePassword(currentPassword, userRow.password_hash);
    if (!isCurrentValid) {
      const err: any = new Error('Current password is incorrect.');
      err.statusCode = 400;
      throw err;
    }

    // Reject reusing the current password
    const isSamePassword = await this.comparePassword(newPassword, userRow.password_hash);
    if (isSamePassword) {
      const err: any = new Error('New password cannot be the same as your current password.');
      err.statusCode = 400;
      throw err;
    }

    // Hash new password using bcrypt (salt rounds: 10)
    const newHash = await this.hashPassword(newPassword);

    // Atomically update password, increment token_version, and update timestamp
    const updatedRes = await query(
      `UPDATE users
       SET password_hash = $1,
           password_changed_at = CURRENT_TIMESTAMP,
           token_version = COALESCE(token_version, 1) + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, name, email, mobile, role, terms_version, terms_accepted_at, status, token_version`,
      [newHash, userId]
    );

    const updatedUser = updatedRes.rows[0];
    return {
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        terms_version: updatedUser.terms_version || null,
        terms_accepted_at: updatedUser.terms_accepted_at ? new Date(updatedUser.terms_accepted_at).toISOString() : null,
        status: updatedUser.status,
        token_version: Number(updatedUser.token_version)
      }
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

  /**
   * Bounded cleanup of expired or already consumed password reset records (Phase 5 Reliability).
   */
  public static async cleanupExpiredPasswordResets(): Promise<number> {
    try {
      const result = await query(
        `DELETE FROM password_resets
         WHERE expires_at < CURRENT_TIMESTAMP OR used_at IS NOT NULL
         RETURNING id`
      );
      return result.rowCount ?? result.rows.length;
    } catch (err: any) {
      console.error('Password resets cleanup failed:', err?.message || 'Database error');
      return 0;
    }
  }

  /**
   * Initiates password recovery.
   * Generates a 256-bit cryptographically secure reset token, persists only its SHA-256 hash,
   * sends the recovery email via Resend, and enforces a 60-second cooldown per email address.
   * If email delivery fails, the newly generated token is immediately invalidated.
   * Prevents email enumeration by returning an identical response for registered, unregistered,
   * and deactivated accounts.
   */
  public static async requestPasswordReset(
    email: string,
    baseUrl?: string
  ): Promise<{ success: boolean; message: string }> {
    const normEmail = String(email || '').trim().toLowerCase();
    const genericMessage = 'If an active account is associated with that email, a password reset link has been sent.';

    if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      const err: any = new Error('Please provide a valid email address.');
      err.statusCode = 400;
      throw err;
    }

    // Anti-enumeration: look up user without disclosing results to client
    const userRes = await query(
      `SELECT id, email, role, COALESCE(status, 'ACTIVE') as status
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [normEmail]
    );

    if (userRes.rows.length === 0 || userRes.rows[0].status === 'DEACTIVATED') {
      // Timing attack countermeasure: simulate token generation & hashing
      crypto.randomBytes(32);
      crypto.createHash('sha256').update('dummy-timing-neutral').digest('hex');
      return { success: true, message: genericMessage };
    }

    const user = userRes.rows[0];

    // Check cooldown for active reset token for this user
    const recentCheck = await query(
      `SELECT created_at, expires_at
       FROM password_resets
       WHERE user_id = $1 AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (recentCheck.rows.length > 0) {
      const lastCreatedAt = new Date(recentCheck.rows[0].created_at).getTime();
      const elapsedMs = Date.now() - lastCreatedAt;
      if (elapsedMs < 60_000) {
        const retrySec = Math.max(1, Math.ceil((60_000 - elapsedMs) / 1000));
        const err: any = new Error(`Please wait ${retrySec} seconds before requesting another password reset link.`);
        err.statusCode = 429;
        err.retryAfterSeconds = retrySec;
        throw err;
      }
    }

    // Generate cryptographically secure 256-bit token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute token expiry

    // Atomically invalidate prior unused reset tokens for this user and insert new one
    let resetRecordId: number | null = null;
    await withTransaction(async (tx) => {
      await tx.query(
        `DELETE FROM password_resets
         WHERE user_id = $1 AND used_at IS NULL`,
        [user.id]
      );

      const insertRes = await tx.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING id`,
        [user.id, tokenHash, expiresAt]
      );
      resetRecordId = insertRes.rows[0]?.id;
    });

    // Resolve client URL for password reset link
    const clientBase = (baseUrl || process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://clik2go.in' : 'http://localhost:5173')).replace(/\/$/, '');
    const resetLink = `${clientBase}/reset-password?token=${rawToken}`;

    // Dispatch email
    try {
      await EmailService.sendPasswordResetLink(user.email, resetLink);
    } catch (emailErr: any) {
      // CRITICAL REQUIREMENT: If email delivery fails, invalidate the newly generated reset token.
      // Never leave a usable token when the reset email was not successfully sent.
      if (resetRecordId) {
        await query(
          `DELETE FROM password_resets WHERE id = $1`,
          [resetRecordId]
        ).catch(() => {});
      }
      console.error('[EmailService] Failed to send password reset email:', emailErr?.message || 'Email delivery failure');
      const err: any = new Error('Failed to deliver password reset email. Please try again later.');
      err.statusCode = 503;
      throw err;
    }

    return { success: true, message: genericMessage };
  }

  /**
   * Pre-validates a reset token without consuming it.
   */
  public static async verifyResetToken(token: string): Promise<{ valid: boolean; error?: string }> {
    if (!token || typeof token !== 'string' || !/^[a-fA-F0-9]{64}$/.test(token.trim())) {
      return { valid: false, error: 'Invalid or malformed password reset link.' };
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    const res = await query(
      `SELECT pr.id, pr.expires_at, pr.used_at, u.status
       FROM password_resets pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (res.rows.length === 0) {
      return { valid: false, error: 'This password reset link is invalid or has expired.' };
    }

    const row = res.rows[0];

    if (row.used_at !== null) {
      return { valid: false, error: 'This password reset link has already been used.' };
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return { valid: false, error: 'This password reset link has expired. Please request a new one.' };
    }

    if (row.status === 'DEACTIVATED') {
      return { valid: false, error: 'This account has been deactivated. Access is denied.' };
    }

    return { valid: true };
  }

  /**
   * Resets the user's password using a verified single-use reset token.
   * Executes within an atomic database transaction using row-level locking (FOR UPDATE)
   * to prevent concurrent reset attempts or simultaneous token submissions.
   * Atomically marks the token as used, updates password_hash, sets password_changed_at,
   * and increments token_version to immediately invalidate all existing sessions.
   */
  public static async resetPassword(
    token: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; user: AuthUser }> {
    if (!token || typeof token !== 'string' || !/^[a-fA-F0-9]{64}$/.test(token.trim())) {
      const err: any = new Error('Invalid or malformed password reset link.');
      err.statusCode = 400;
      throw err;
    }

    if (!newPassword || typeof newPassword !== 'string') {
      const err: any = new Error('New password is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!confirmPassword || typeof confirmPassword !== 'string') {
      const err: any = new Error('Password confirmation is required.');
      err.statusCode = 400;
      throw err;
    }

    if (newPassword.length < 12) {
      const err: any = new Error('New password must be at least 12 characters long.');
      err.statusCode = 400;
      throw err;
    }

    if (newPassword !== confirmPassword) {
      const err: any = new Error('New password and confirmation do not match.');
      err.statusCode = 400;
      throw err;
    }

    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');

    // Atomic transaction with row-level locking to prevent concurrent token submissions
    const result = await withTransaction(async (tx) => {
      const resetRes = await tx.query(
        `SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at,
                u.id as user_id_val, u.name, u.email, u.mobile, u.role, u.password_hash,
                COALESCE(u.status, 'ACTIVE') as status,
                COALESCE(u.token_version, 1) as token_version
         FROM password_resets pr
         JOIN users u ON pr.user_id = u.id
         WHERE pr.token_hash = $1
         LIMIT 1
         FOR UPDATE`,
        [tokenHash]
      );

      if (resetRes.rows.length === 0) {
        const err: any = new Error('This password reset link is invalid or has expired.');
        err.statusCode = 400;
        throw err;
      }

      const resetRow = resetRes.rows[0];

      if (resetRow.used_at !== null) {
        const err: any = new Error('This password reset link has already been used.');
        err.statusCode = 400;
        throw err;
      }

      if (new Date(resetRow.expires_at).getTime() <= Date.now()) {
        const err: any = new Error('This password reset link has expired. Please request a new one.');
        err.statusCode = 400;
        throw err;
      }

      if (resetRow.status === 'DEACTIVATED') {
        const err: any = new Error('This account has been deactivated. Access is denied.');
        err.statusCode = 403;
        throw err;
      }

      // Reject identical password reuse
      const isSamePassword = await this.comparePassword(newPassword, resetRow.password_hash);
      if (isSamePassword) {
        const err: any = new Error('New password cannot be the same as your previous password.');
        err.statusCode = 400;
        throw err;
      }

      // Hash new password using bcrypt (salt rounds: 10)
      const newHash = await this.hashPassword(newPassword);

      // Atomically mark token as used
      await tx.query(
        `UPDATE password_resets
         SET used_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [resetRow.id]
      );

      // Clean up any remaining unused tokens for this user
      await tx.query(
        `DELETE FROM password_resets
         WHERE user_id = $1 AND id != $2`,
        [resetRow.user_id, resetRow.id]
      );

      // Atomically update password, set password_changed_at, and increment token_version
      const updateRes = await tx.query(
        `UPDATE users
         SET password_hash = $1,
             password_changed_at = CURRENT_TIMESTAMP,
             token_version = COALESCE(token_version, 1) + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, name, email, mobile, role, terms_version, terms_accepted_at, status, token_version`,
        [newHash, resetRow.user_id]
      );

      const updatedUser = updateRes.rows[0];
      return {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        mobile: updatedUser.mobile,
        role: updatedUser.role,
        status: updatedUser.status,
        token_version: Number(updatedUser.token_version)
      };
    });

    return { success: true, user: result as AuthUser };
  }
}
