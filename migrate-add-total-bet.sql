-- Add total_bet column to game_players table
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS total_bet INTEGER DEFAULT 0;

-- Update existing rows to set total_bet to 0
UPDATE game_players SET total_bet = 0 WHERE total_bet IS NULL;
