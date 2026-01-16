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
    
    console.log('=== Game 28 State ===');
    const game = await client.query('SELECT * FROM games WHERE id = 28');
    console.log('Game:', JSON.stringify(game.rows[0], null, 2));
    
    console.log('\n=== Players ===');
    const players = await client.query('SELECT * FROM game_players WHERE game_id = 28 ORDER BY position');
    players.rows.forEach(p => {
      console.log(`${p.position}: ${p.player_name} - status: ${p.status}, chips: ${p.chips}, bet: ${p.current_bet}, has_acted: ${p.has_acted}, is_ai: ${p.is_ai}`);
    });
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
