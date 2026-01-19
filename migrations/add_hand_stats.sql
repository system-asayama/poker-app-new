-- Add hand statistics columns to game_players table
ALTER TABLE game_players 
ADD COLUMN IF NOT EXISTS hand_start_chips INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hand_bet_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hand_won_amount INTEGER DEFAULT 0;

-- Update existing rows to set default values
UPDATE game_players 
SET hand_start_chips = chips,
    hand_bet_amount = total_bet,
    hand_won_amount = 0
WHERE hand_start_chips IS NULL OR hand_start_chips = 0;
