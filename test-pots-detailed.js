// Test calculatePots with detailed logging

function calculatePots(playerBets) {
  const activeBets = playerBets.filter(p => p.status !== 'folded');
  
  if (activeBets.length === 0) {
    return [];
  }
  
  const sortedBets = [...activeBets].sort((a, b) => a.bet - b.bet);
  
  const pots = [];
  let remainingPlayers = sortedBets.map(p => p.playerId);
  let previousBetLevel = 0;
  
  console.log('\n=== Starting pot calculation ===');
  console.log('Active bets:', JSON.stringify(sortedBets, null, 2));
  console.log('Initial remaining players:', remainingPlayers);
  
  for (let i = 0; i < sortedBets.length; i++) {
    const currentBetLevel = sortedBets[i].bet;
    
    console.log(`\n--- Iteration ${i} ---`);
    console.log(`Player ${sortedBets[i].playerId}: bet=${currentBetLevel}`);
    console.log(`Previous bet level: ${previousBetLevel}`);
    console.log(`Remaining players before: ${remainingPlayers}`);
    
    if (currentBetLevel === previousBetLevel) {
      console.log('Skipping (same bet level)');
      continue;
    }
    
    const betDifference = currentBetLevel - previousBetLevel;
    const potAmount = betDifference * remainingPlayers.length;
    
    console.log(`Bet difference: ${betDifference}`);
    console.log(`Pot amount: ${betDifference} × ${remainingPlayers.length} = ${potAmount}`);
    
    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayers: [...remainingPlayers]
      });
      console.log(`Added pot: ${potAmount} chips for players ${remainingPlayers}`);
    }
    
    remainingPlayers = remainingPlayers.filter(id => id !== sortedBets[i].playerId);
    console.log(`Remaining players after: ${remainingPlayers}`);
    
    previousBetLevel = currentBetLevel;
  }
  
  console.log('\n=== Final pots ===');
  console.log(JSON.stringify(pots, null, 2));
  
  const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
  const totalBet = playerBets.reduce((sum, p) => sum + p.bet, 0);
  console.log(`\nTotal pot: ${totalPot}`);
  console.log(`Total bet: ${totalBet}`);
  console.log(`Difference: ${totalBet - totalPot}`);
  
  return pots;
}

// Test case: 2 players with equal bets (like the game)
console.log('\n========================================');
console.log('Test: 2 players with equal bets');
console.log('========================================');
const result1 = calculatePots([
  { playerId: 1, bet: 980, status: 'active' },
  { playerId: 2, bet: 980, status: 'active' }
]);

// Test case: 2 players with different bets
console.log('\n========================================');
console.log('Test: 2 players with different bets');
console.log('========================================');
const result2 = calculatePots([
  { playerId: 1, bet: 500, status: 'allin' },
  { playerId: 2, bet: 980, status: 'active' }
]);

// Test case: 3 players with different bets
console.log('\n========================================');
console.log('Test: 3 players with different bets');
console.log('========================================');
const result3 = calculatePots([
  { playerId: 1, bet: 100, status: 'active' },
  { playerId: 2, bet: 200, status: 'active' },
  { playerId: 3, bet: 300, status: 'active' }
]);
