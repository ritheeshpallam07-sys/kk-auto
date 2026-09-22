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

export async function getDbClient() {
  if (process.env.DATABASE_URL) {
    if (!pool) {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
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
