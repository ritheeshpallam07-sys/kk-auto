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
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
  }

  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM]
    }) as AuthUser;

    const tokenIdentifier = decoded.jti || crypto.createHash('sha256').update(token).digest('hex');

    // Single unified query: checks user active status AND token revocation status in one roundtrip
    const userRes = await query(
      `SELECT u.status,
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
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Access is denied. Contact support@clik2go.in.'
      });
    }

    if (Boolean(userRes.rows[0].is_revoked)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired session. Please log in again.'
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
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
