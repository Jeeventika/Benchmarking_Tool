import pg from 'pg'
import 'dotenv/config'

const { Pool } = pg

// Single shared connection pool. The frontend never sees this —
// only backend services talk to Postgres.
export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'decision_support',
})

export async function testConnection() {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
    return true
  } finally {
    client.release()
  }
}
