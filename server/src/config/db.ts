import path from 'path';
import fs from 'fs';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';

let pool: Pool | null = null;
let pgliteInstance: PGlite | null = null;

export interface QueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

export interface DbTransactionClient {
  query: <T = any>(sql: string, params?: any[]) => Promise<QueryResult<T>>;
}

/**
 * Resolves SSL/TLS configuration for PostgreSQL connection.
 * - Local PGlite (empty/unset dbUrl): returns false
 * - Local loopback host (localhost/127.0.0.1/::1) without explicit sslmode=require: returns false
 * - Remote cloud databases (Neon, Render, Supabase) or production: returns { rejectUnauthorized: true }
 *   (Strict TLS certificate verification using trusted root CAs; never downgrades to plaintext).
 * - Malformed URL: returns { rejectUnauthorized: true } in production to prevent plaintext transmission.
 */
export function resolveDbSsl(dbUrl?: string, nodeEnv?: string): boolean | { rejectUnauthorized: boolean } {
  if (!dbUrl || dbUrl.trim() === '') {
    return false;
  }

  try {
    const parsed = new URL(dbUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const sslModeParam = parsed.searchParams.get('sslmode')?.toLowerCase();

    if (isLocal && sslModeParam !== 'require' && sslModeParam !== 'verify-full' && sslModeParam !== 'verify-ca') {
      return false;
    }

    // Remote cloud host or production requires TLS with strict certificate verification
    return { rejectUnauthorized: true };
  } catch {
    console.error('[Database Config] Warning: Failed to parse DATABASE_URL format.');
    // In production, remote or unparseable URLs must never downgrade to unencrypted plaintext
    if (nodeEnv === 'production') {
      return { rejectUnauthorized: true };
    }
    return false;
  }
}

export function _resetPoolForTesting(): void {
  if (pool) {
    pool.end().catch(() => {});
    pool = null;
  }
}

export async function getDbClient() {
  if (process.env.DATABASE_URL) {
    if (!pool) {
      const sslConfig = resolveDbSsl(process.env.DATABASE_URL, process.env.NODE_ENV);
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: sslConfig
      });

      pool.on('error', (err: any) => {
        // Safe idle client error logging - never expose connection strings, passwords, or SQL parameters
        const errorCode = (err && (err.code || err.name)) ? String(err.code || err.name) : 'IDLE_CLIENT_ERROR';
        console.error(`[Database Pool Error] Unexpected error on idle client: ${errorCode}`);
      });
    }
    return {
      query: async <T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> => {
        const res = await pool!.query(sql, params);
        return { rows: res.rows, rowCount: res.rowCount ?? 0 };
      },
      exec: async (sql: string): Promise<void> => {
        await pool!.query(sql);
      }
    };
  }

  // Embedded PostgreSQL via PGlite
  if (!pgliteInstance) {
    const dataDir = path.resolve(__dirname, '../../.data/pglite');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    pgliteInstance = new PGlite(dataDir);
    await pgliteInstance.waitReady;
  }

  return {
    query: async <T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> => {
      const res = await pgliteInstance!.query<T>(sql, params);
      return { rows: res.rows, rowCount: res.rows.length };
    },
    exec: async (sql: string): Promise<void> => {
      await pgliteInstance!.exec(sql);
    }
  };
}

export async function query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
  const client = await getDbClient();
  return client.query<T>(sql, params);
}

export async function withTransaction<T>(
  callback: (tx: DbTransactionClient) => Promise<T>
): Promise<T> {
  await getDbClient();

  if (process.env.DATABASE_URL) {
    const pgClient = await pool!.connect();
    try {
      await pgClient.query('BEGIN');
      const txClient: DbTransactionClient = {
        query: async <R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> => {
          const res = await pgClient.query(sql, params);
          return { rows: res.rows, rowCount: res.rowCount ?? 0 };
        }
      };
      const result = await callback(txClient);
      await pgClient.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await pgClient.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Transaction rollback error:', rollbackErr);
      }
      throw err;
    } finally {
      pgClient.release();
    }
  } else {
    // Embedded PGlite
    return await pgliteInstance!.transaction(async (tx) => {
      const txClient: DbTransactionClient = {
        query: async <R = any>(sql: string, params?: any[]): Promise<QueryResult<R>> => {
          const res = await tx.query<R>(sql, params);
          return { rows: res.rows, rowCount: res.rows.length };
        }
      };
      return await callback(txClient);
    });
  }
}

export async function initDb() {
  const client = await getDbClient();
  let schemaPath = path.resolve(__dirname, '../db/schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve(__dirname, '../../src/db/schema.sql');
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  await client.exec(schemaSql);
  console.log('[Database] Schema initialized successfully.');
}
