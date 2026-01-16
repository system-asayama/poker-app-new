-- Add AI columns to game_players table
ALTER TABLE game_players DROP CONSTRAINT IF EXISTS game_players_user_id_fkey;
ALTER TABLE game_players ADD CONSTRAINT game_players_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE game_players DROP CONSTRAINT IF EXISTS game_players_game_id_user_id_key;

ALTER TABLE game_players ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT FALSE;
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS ai_difficulty VARCHAR(20);
ALTER TABLE game_players ADD COLUMN IF NOT EXISTS ai_name VARCHAR(100);

ALTER TABLE game_players ADD CONSTRAINT check_ai_difficulty 
  CHECK (ai_difficulty IS NULL OR ai_difficulty IN ('easy', 'medium', 'hard'));
