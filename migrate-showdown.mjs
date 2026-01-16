import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Adding columns to game_players table...');
    await client.query(`
      ALTER TABLE game_players 
      ADD COLUMN IF NOT EXISTS hand_rank VARCHAR(50),
      ADD COLUMN IF NOT EXISTS hand_description VARCHAR(100)
    `);
    
    console.log('Adding winners column to games table...');
    await client.query(`
      ALTER TABLE games 
      ADD COLUMN IF NOT EXISTS winners TEXT
    `);
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
