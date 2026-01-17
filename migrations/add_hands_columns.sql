-- Add max_hands and current_hand columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS max_hands INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS current_hand INTEGER DEFAULT 1;

-- Update existing games to have current_hand = 1
UPDATE games SET current_hand = 1 WHERE current_hand IS NULL;
