import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log('✅ Database schema initialized successfully');
    
    // Run migrations for showdown feature
    await pool.query(`
      ALTER TABLE game_players 
      ADD COLUMN IF NOT EXISTS hand_rank VARCHAR(50),
      ADD COLUMN IF NOT EXISTS hand_description VARCHAR(100)
    `);
    await pool.query(`
      ALTER TABLE games 
      ADD COLUMN IF NOT EXISTS winners TEXT
    `);
    console.log('✅ Showdown migrations applied successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Query error:', { text, error });
    throw error;
  }
}

export async function getClient() {
  return await pool.connect();
}

export default pool;
