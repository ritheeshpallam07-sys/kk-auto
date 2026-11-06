import { query, DbTransactionClient } from '../config/db';

const SENSITIVE_KEY_REGEX = /password|hash|token|secret|otp|jwt|authorization|key|cvv|pin/i;

/**
 * Recursively redacts sensitive keys from audit log detail objects.
 */
export function sanitizeAuditDetails(data: any, depth = 0): any {
  if (depth > 5 || data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditDetails(item, depth + 1));
  }
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE_KEY_REGEX.test(k)) {
      clean[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitizeAuditDetails(v, depth + 1);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

export interface AdminAuditEntry {
  adminId?: number | null;
  adminEmail: string;
  action: string;
  targetType?: string | null;
  targetId?: string | number | null;
  details?: Record<string, any> | null;
  clientIp?: string | null;
}

export interface AuditLogRecord {
  id: number;
  admin_id?: number | null;
  admin_email: string;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details?: Record<string, any> | null;
  client_ip?: string | null;
  created_at: string;
}

export class AuditService {
  /**
   * Records an admin action in admin_audit_logs.
   * Can execute within an active database transaction (txClient) or standalone.
   */
  public static async logAction(
    entry: AdminAuditEntry,
    txClient?: DbTransactionClient
  ): Promise<void> {
    const db = txClient || { query };
    const safeDetails = entry.details ? JSON.stringify(sanitizeAuditDetails(entry.details)) : null;
    const targetIdStr = entry.targetId !== undefined && entry.targetId !== null ? String(entry.targetId) : null;

    await db.query(
      `INSERT INTO admin_audit_logs (
         admin_id, admin_email, action, target_type, target_id, details_json, client_ip, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        entry.adminId || null,
        entry.adminEmail,
        entry.action,
        entry.targetType || null,
        targetIdStr,
        safeDetails,
        entry.clientIp || null
      ]
    );
  }

  /**
   * Retrieves paginated, filtered audit logs.
   */
  public static async getLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    admin?: string;
    targetId?: string;
    targetType?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    logs: AuditLogRecord[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: any[] = [];
    let idx = 1;

    if (params.action && params.action.trim()) {
      conditions.push(`action = $${idx++}`);
      values.push(params.action.trim());
    }

    if (params.admin && params.admin.trim()) {
      conditions.push(`(admin_email ILIKE $${idx} OR CAST(admin_id AS TEXT) = $${idx})`);
      values.push(`%${params.admin.trim()}%`);
      idx++;
    }

    if (params.targetId && params.targetId.trim()) {
      conditions.push(`target_id = $${idx++}`);
      values.push(params.targetId.trim());
    }

    if (params.targetType && params.targetType.trim()) {
      conditions.push(`target_type = $${idx++}`);
      values.push(params.targetType.trim());
    }

    if (params.startDate && !isNaN(Date.parse(params.startDate))) {
      conditions.push(`created_at >= $${idx++}`);
      values.push(new Date(params.startDate).toISOString());
    }

    if (params.endDate && !isNaN(Date.parse(params.endDate))) {
      conditions.push(`created_at <= $${idx++}`);
      values.push(new Date(params.endDate).toISOString());
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRes = await query(
      `SELECT COUNT(*) as total FROM admin_audit_logs WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch records
    const queryValues = [...values, limit, offset];
    const logsRes = await query(
      `SELECT id, admin_id, admin_email, action, target_type, target_id, details_json, client_ip, created_at
       FROM admin_audit_logs
       WHERE ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      queryValues
    );

    const logs: AuditLogRecord[] = logsRes.rows.map((row) => ({
      id: row.id,
      admin_id: row.admin_id,
      admin_email: row.admin_email,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      details: typeof row.details_json === 'string' ? JSON.parse(row.details_json) : (row.details_json || null),
      client_ip: row.client_ip,
      created_at: row.created_at
    }));

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    };
  }
}
