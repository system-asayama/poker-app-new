import express from 'express';
import { query } from '../database/db.js';

const router = express.Router();

// Temporary migration endpoint
router.post('/run-hands-migration', async (req, res) => {
  try {
    console.log('[Migration] Running hands columns migration...');
    
    // Add max_hands column
    await query(`
      ALTER TABLE games ADD COLUMN IF NOT EXISTS max_hands INTEGER
    `);
    console.log('[Migration] Added max_hands column');
    
    // Add current_hand column
    await query(`
      ALTER TABLE games ADD COLUMN IF NOT EXISTS current_hand INTEGER DEFAULT 1
    `);
    console.log('[Migration] Added current_hand column');
    
    // Update existing games
    await query(`
      UPDATE games SET current_hand = 1 WHERE current_hand IS NULL
    `);
    console.log('[Migration] Updated existing games');
    
    res.json({ success: true, message: 'Migration completed successfully' });
  } catch (error: any) {
    console.error('[Migration] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
