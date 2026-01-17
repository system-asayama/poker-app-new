import pg from 'pg';
import { evaluateHand } from './src/server/game/handEvaluator.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testGame67() {
  const client = await pool.connect();
  
  try {
    // Get game data
    const gameResult = await client.query('SELECT * FROM games WHERE id = 67');
    const game = gameResult.rows[0];
    
    console.log('Community Cards:', game.community_cards);
    
    // Get all players
    const playersResult = await client.query(
      'SELECT * FROM game_players WHERE game_id = 67 ORDER BY position'
    );
    
    console.log('\n=== Hand Evaluation ===\n');
    
    const evaluations = [];
    
    for (const player of playersResult.rows) {
      const holeCards = player.hole_cards;
      const communityCards = game.community_cards;
      
      const handResult = evaluateHand(holeCards, communityCards);
      
      const playerName = player.ai_name || 'User';
      
      console.log(`${playerName}:`);
      console.log(`  Hole Cards: ${holeCards.map(c => c.rank + c.suit[0]).join(' ')}`);
      console.log(`  Hand Rank: ${handResult.rank}`);
      console.log(`  Hand Value: ${handResult.value}`);
      console.log(`  Status: ${player.status}`);
      console.log('');
      
      evaluations.push({
        playerId: player.id,
        playerName,
        handResult,
        status: player.status
      });
    }
    
    // Find winner among active players
    const activePlayers = evaluations.filter(e => e.status === 'active' || e.status === 'allin');
    activePlayers.sort((a, b) => b.handResult.value - a.handResult.value);
    
    console.log('=== Winner ===');
    console.log(`Winner: ${activePlayers[0].playerName}`);
    console.log(`Hand: ${activePlayers[0].handResult.rank}`);
    console.log(`Value: ${activePlayers[0].handResult.value}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

testGame67().catch(console.error);
