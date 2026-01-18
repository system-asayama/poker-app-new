-- Add side_pots and winners columns to games table
ALTER TABLE games ADD COLUMN IF NOT EXISTS side_pots JSONB DEFAULT '[]';
ALTER TABLE games ADD COLUMN IF NOT EXISTS winners JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN games.side_pots IS 'Array of side pots: [{ amount: number, eligiblePlayers: number[] }]';
COMMENT ON COLUMN games.winners IS 'Array of winners: [{ playerId: number, amount: number, potIndex: number }]';
