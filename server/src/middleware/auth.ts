import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/db';

export const JWT_ALGORITHM: jwt.Algorithm = 'HS256';
export const DEFAULT_DEV_JWT_SECRET = 'kk_auto_super_secure_jwt_secret_2025';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (!secret || secret.trim() === '' || secret === DEFAULT_DEV_JWT_SECRET) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is missing, empty, or set to insecure default in production mode.'
      );
    }
    return secret;
  }

  if (!secret) {
    return DEFAULT_DEV_JWT_SECRET;
  }

  return secret;
}

export const JWT_SECRET = getJwtSecret();

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: 'customer' | 'driver' | 'admin';
  terms_version?: string | null;
  terms_accepted_at?: string | null;
  status?: string | null;
  jti?: string;
  exp?: number;
  iat?: number;
  token_version?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      cookies?: Record<string, string>;
    }
  }
}

/**
 * Robust zero-dependency cookie parser
 */
export function parseCookies(header?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header || typeof header !== 'string') return cookies;

  const parts = header.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

/**
 * Standard cookie configuration for HttpOnly JWT session cookies (SEC-05)
 */
export const getCookieOptions = (role?: 'customer' | 'driver' | 'admin') => {
  const isProduction = process.env.NODE_ENV === 'production';
  // Admin: 2 hours, Customer/Driver: 7 days
  const maxAge = role === 'admin' ? 2 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  let sameSite: 'lax' | 'strict' | 'none' = isProduction ? 'none' : 'lax';
  if (process.env.COOKIE_SAME_SITE && ['lax', 'strict', 'none'].includes(process.env.COOKIE_SAME_SITE)) {
    sameSite = process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none';
  }
  const secure = isProduction || sameSite === 'none';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    maxAge
  };
};

/**
 * Standard cookie configuration for double-submit CSRF token (SEC-05)
 */
export const getCsrfCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  let sameSite: 'lax' | 'strict' | 'none' = isProduction ? 'none' : 'lax';
  if (process.env.COOKIE_SAME_SITE && ['lax', 'strict', 'none'].includes(process.env.COOKIE_SAME_SITE)) {
    sameSite = process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none';
  }
  const secure = isProduction || sameSite === 'none';

  return {
    httpOnly: false, // Accessible to SPA JavaScript to read and attach in X-CSRF-Token header
    secure,
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  };
};

/**
 * Cookie options used when clearing session and CSRF cookies on logout or revocation
 */
export const getClearCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  let sameSite: 'lax' | 'strict' | 'none' = isProduction ? 'none' : 'lax';
  if (process.env.COOKIE_SAME_SITE && ['lax', 'strict', 'none'].includes(process.env.COOKIE_SAME_SITE)) {
    sameSite = process.env.COOKIE_SAME_SITE as 'lax' | 'strict' | 'none';
  }
  const secure = isProduction || sameSite === 'none';

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/'
  };
};

/**
 * Cryptographically random 256-bit CSRF token generation
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF Protection Middleware for cookie-authenticated mutating requests (SEC-05)
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Safe HTTP methods do not mutate state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Bypass server-to-server webhooks with independent HMAC signatures (e.g. Cashfree)
  const pathname = (req.originalUrl || req.url || '').split('?')[0];
  if (pathname === '/api/payments/webhook') {
    return next();
  }

  const cookies = req.cookies || parseCookies(req.headers.cookie);
  const authCookie = cookies['kk_token'];

  // Only enforce CSRF for requests using cookie authentication
  if (authCookie) {
    const csrfCookie = cookies['kk_csrf'];
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || typeof csrfHeader !== 'string' || csrfCookie !== csrfHeader) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or missing CSRF token.'
      });
    }
  }

  next();
}

/**
 * Authenticates JWT sessions from HttpOnly cookies (preferred) or Authorization header (fallback)
 * and synchronizes user role in real time from database (SEC-03 & SEC-05).
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const cookies = req.cookies || parseCookies(req.headers.cookie);
  let token = cookies['kk_token'];

  // Fallback to Authorization header for migration, tests, and non-browser clients
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM]
    }) as AuthUser;

    const tokenIdentifier = decoded.jti || crypto.createHash('sha256').update(token).digest('hex');

    // Single unified query: checks user active status, token_version, password_changed_at,
    // revocation status, AND live database role (SEC-03)
    const userRes = await query(
      `SELECT u.id,
              u.name,
              u.email,
              u.mobile,
              u.role,
              u.status,
              COALESCE(u.token_version, 1) as token_version,
              u.password_changed_at,
              EXISTS(
                SELECT 1 FROM revoked_tokens rt
                WHERE rt.token_identifier = $2
              ) AS is_revoked
       FROM users u
       WHERE u.id = $1
       LIMIT 1`,
      [decoded.id, tokenIdentifier]
    );

    if (userRes.rows.length === 0 || userRes.rows[0].status === 'DEACTIVATED') {
      if (typeof res.clearCookie === 'function') {
        res.clearCookie('kk_token', getClearCookieOptions());
        res.clearCookie('kk_csrf', getClearCookieOptions());
      }
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Access is denied. Contact supportclik2go@gmail.com.'
      });
    }

    if (Boolean(userRes.rows[0].is_revoked)) {
      if (typeof res.clearCookie === 'function') {
        res.clearCookie('kk_token', getClearCookieOptions());
        res.clearCookie('kk_csrf', getClearCookieOptions());
      }
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired session. Please log in again.'
      });
    }

    // Revoke token if user has changed password (token_version incremented or password_changed_at updated)
    const currentTokenVersion = Number(userRes.rows[0].token_version) || 1;
    const tokenVersion = Number(decoded.token_version) || 1;
    if (tokenVersion < currentTokenVersion) {
      if (typeof res.clearCookie === 'function') {
        res.clearCookie('kk_token', getClearCookieOptions());
        res.clearCookie('kk_csrf', getClearCookieOptions());
      }
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired session. Please log in again.'
      });
    }

    if (userRes.rows[0].password_changed_at && decoded.iat) {
      const pwdChangedSec = Math.floor(new Date(userRes.rows[0].password_changed_at).getTime() / 1000);
      if (decoded.iat < pwdChangedSec) {
        if (typeof res.clearCookie === 'function') {
          res.clearCookie('kk_token', getClearCookieOptions());
          res.clearCookie('kk_csrf', getClearCookieOptions());
        }
        return res.status(403).json({
          success: false,
          error: 'Invalid or expired session. Please log in again.'
        });
      }
    }

    // SEC-03: Always populate live role directly from current database state,
    // never trusting a potentially outdated claim inside the JWT payload
    const liveUser = userRes.rows[0];
    req.user = {
      ...decoded,
      id: liveUser.id,
      role: liveUser.role, // Fresh database role!
      name: liveUser.name,
      email: liveUser.email,
      mobile: liveUser.mobile,
      status: liveUser.status
    };

    next();
  } catch (err) {
    if (typeof res.clearCookie === 'function') {
      res.clearCookie('kk_token', getClearCookieOptions());
      res.clearCookie('kk_csrf', getClearCookieOptions());
    }
    return res.status(403).json({ success: false, error: 'Invalid or expired session. Please log in again.' });
  }
}

export function requireRole(allowedRoles: Array<'customer' | 'driver' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of: [${allowedRoles.join(', ')}]`
      });
    }
    next();
  };
}
