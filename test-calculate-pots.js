// Test calculatePots function

function calculatePots(playerBets) {
  // Filter out folded players
  const activeBets = playerBets.filter(p => p.status !== 'folded');
  
  if (activeBets.length === 0) {
    return [];
  }
  
  // Sort by bet amount (ascending)
  const sortedBets = [...activeBets].sort((a, b) => a.bet - b.bet);
  
  const pots = [];
  let remainingPlayers = sortedBets.map(p => p.playerId);
  let previousBetLevel = 0;
  
  for (let i = 0; i < sortedBets.length; i++) {
    const currentBetLevel = sortedBets[i].bet;
    
    // Skip if this player has the same bet as previous
    if (currentBetLevel === previousBetLevel) {
      continue;
    }
    
    // Calculate pot amount for this level
    const betDifference = currentBetLevel - previousBetLevel;
    const potAmount = betDifference * remainingPlayers.length;
    
    console.log(`Level ${i}: betDifference=${betDifference}, remainingPlayers=${remainingPlayers.length}, potAmount=${potAmount}`);
    
    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayers: [...remainingPlayers]
      });
    }
    
    // Remove current player from eligible players for next pot
    // (they're all-in and can't win more)
    if (sortedBets[i].status === 'allin') {
      remainingPlayers = remainingPlayers.filter(id => id !== sortedBets[i].playerId);
    }
    
    previousBetLevel = currentBetLevel;
  }
  
  return pots;
}

// Test case: 3 players, each starts with 1000 chips
// Assume they all bet different amounts
const playerBets = [
  { playerId: 1, bet: 100, status: 'active' },
  { playerId: 2, bet: 200, status: 'active' },
  { playerId: 3, bet: 300, status: 'active' }
];

console.log('Player bets:', playerBets);
const pots = calculatePots(playerBets);
console.log('Calculated pots:', pots);

// Calculate total pot
const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
console.log('Total pot:', totalPot);

// Expected: 100 + 200 + 300 = 600
console.log('Expected total:', 100 + 200 + 300);
