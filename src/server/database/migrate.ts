import { query } from './db.js';

export async function runMigrations() {
  console.log('[Migration] Starting database migrations...');
  
  try {
    // Add total_bet column if it doesn't exist
    await query(`
      ALTER TABLE game_players 
      ADD COLUMN IF NOT EXISTS total_bet INTEGER DEFAULT 0
    `);
    
    console.log('[Migration] Added total_bet column to game_players table');
    
    // Update existing rows
    await query(`
      UPDATE game_players 
      SET total_bet = 0 
      WHERE total_bet IS NULL
    `);
    
    console.log('[Migration] Database migrations completed successfully');
  } catch (error) {
    console.error('[Migration] Error running migrations:', error);
    throw error;
  }
}
