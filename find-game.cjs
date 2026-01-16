const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

(async () => {
  try {
    await client.connect();
    
    const game = await client.query("SELECT * FROM games WHERE room_code = 'ODTDCI'");
    if (game.rows.length > 0) {
      console.log('Game found:', JSON.stringify(game.rows[0], null, 2));
      
      const gameId = game.rows[0].id;
      const players = await client.query('SELECT * FROM game_players WHERE game_id = $1 ORDER BY position', [gameId]);
      console.log('\nPlayers:');
      players.rows.forEach(p => {
        console.log(`${p.position}: ${p.player_name || p.ai_name} - status: ${p.status}, chips: ${p.chips}, bet: ${p.current_bet}, is_ai: ${p.is_ai}`);
      });
      
      const actions = await client.query("SELECT * FROM game_actions WHERE game_id = $1 AND phase = $2 ORDER BY created_at", [gameId, game.rows[0].current_phase]);
      console.log(`\nActions in ${game.rows[0].current_phase} phase:`, actions.rows.length);
      actions.rows.forEach(a => {
        console.log(`Player ${a.player_id}: ${a.action} ${a.amount}`);
      });
    } else {
      console.log('Game ODTDCI not found');
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
