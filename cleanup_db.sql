-- Clean up invalid game_players records
DELETE FROM game_players WHERE chips IS NULL OR current_bet IS NULL;

-- Reset all games to waiting status
UPDATE games SET status = 'waiting', current_phase = 'waiting', pot = 0, community_cards = '[]', deck = '[]', current_turn = NULL WHERE status != 'finished';

-- Show remaining game_players
SELECT id, game_id, user_id, position, chips, current_bet, is_ai, ai_name FROM game_players ORDER BY game_id, position;
