import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';

export const JWT_SECRET = process.env.JWT_SECRET || 'kk_auto_super_secure_jwt_secret_2025';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: 'customer' | 'driver' | 'admin';
  terms_version?: string | null;
  terms_accepted_at?: string | null;
  status?: string | null;
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
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    // Check if user is active in database (rejects deactivated accounts immediately)
    const userRes = await query(
      `SELECT status FROM users WHERE id = $1 LIMIT 1`,
      [decoded.id]
    );

    if (userRes.rows.length === 0 || userRes.rows[0].status === 'DEACTIVATED') {
      return res.status(403).json({
        success: false,
        error: 'Your account has been deactivated. Access is denied. Contact support@clik2go.in.'
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
