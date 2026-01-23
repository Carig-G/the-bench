import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({
  connectionString,
  // SSL configuration for production (e.g., Heroku, Railway, etc.)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
});

// Helper to convert SQLite-style ? placeholders to PostgreSQL $1, $2, etc.
// This is used internally - routes should use $1, $2 directly for new code
export function convertPlaceholders(sql: string): string {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

// Query helper that matches the old synchronous API pattern but async
export const db = {
  async query<T = any>(text: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
    const result = await pool.query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount || 0 };
  },

  async queryOne<T = any>(text: string, params?: any[]): Promise<T | undefined> {
    const result = await pool.query(text, params);
    return result.rows[0] as T | undefined;
  },

  async execute(text: string, params?: any[]): Promise<{ rowCount: number; lastId?: number }> {
    const result = await pool.query(text + ' RETURNING id', params);
    return {
      rowCount: result.rowCount || 0,
      lastId: result.rows[0]?.id,
    };
  },

  async executeNoReturn(text: string, params?: any[]): Promise<{ rowCount: number }> {
    const result = await pool.query(text, params);
    return { rowCount: result.rowCount || 0 };
  },

  // Transaction helper
  async transaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // For direct pool access when needed
  pool,

  // Close the pool (for cleanup)
  async close(): Promise<void> {
    await pool.end();
  },
};

export default db;
