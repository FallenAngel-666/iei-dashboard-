/**
 * MGR IEI Students Chapter PostgreSQL Client & Connection Pool
 * Optimized for serverless environments (Vercel, Neon, Supabase)
 * with automatic SSL configuration and parameterized query protection.
 */

const { Pool } = require('pg');
const config = require('../config');

let pool = null;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  // Parse connection config with secure SSL defaults
  const poolConfig = {
    connectionString,
    max: process.env.DB_MAX_CONNECTIONS ? parseInt(process.env.DB_MAX_CONNECTIONS, 10) : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  // Enable SSL for cloud databases (Neon, Supabase, RDS, Heroku, etc.)
  if (process.env.NODE_ENV === 'production' || connectionString.includes('neon.tech') || connectionString.includes('supabase.co')) {
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }

  pool = new Pool(poolConfig);

  pool.on('error', (err) => {
    console.error('[PostgreSQL Pool Error]: Unexpected client error', err.message);
  });

  return pool;
}

/**
 * Executes a parameterized SQL query
 * @param {string} text - SQL statement with $1, $2 placeholders
 * @param {Array} params - Parameter values
 * @returns {Promise<Object>}
 */
async function query(text, params = []) {
  const p = getPool();
  if (!p) {
    throw new Error('PostgreSQL is not configured. DATABASE_URL environment variable is missing.');
  }

  const start = Date.now();
  try {
    const res = await p.query(text, params);
    const duration = Date.now() - start;
    if (config.NODE_ENV !== 'production' && process.env.DEBUG_SQL === 'true') {
      console.log(`[SQL Query] (${duration}ms):`, text);
    }
    return res;
  } catch (err) {
    console.error(`[SQL Error]: ${err.message}`);
    throw err;
  }
}

/**
 * Executes a callback within a managed database transaction
 * @param {Function} callback - async (client) => result
 * @returns {Promise<any>}
 */
async function withTransaction(callback) {
  const p = getPool();
  if (!p) {
    throw new Error('PostgreSQL is not configured.');
  }

  const client = await p.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Checks connectivity to the database without exposing credentials
 */
async function testConnection() {
  const p = getPool();
  if (!p) return { connected: false, reason: 'DATABASE_URL not set' };

  try {
    const res = await p.query('SELECT NOW() AS server_time, current_database() AS db_name');
    return {
      connected: true,
      serverTime: res.rows[0].server_time,
      database: res.rows[0].db_name
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

module.exports = {
  getPool,
  query,
  withTransaction,
  testConnection
};
