// Test calculatePots function (fixed version)

function calculatePots(playerBets) {
  const activeBets = playerBets.filter(p => p.status !== 'folded');
  
  if (activeBets.length === 0) {
    return [];
  }
  
  const sortedBets = [...activeBets].sort((a, b) => a.bet - b.bet);
  
  const pots = [];
  let remainingPlayers = sortedBets.map(p => p.playerId);
  let previousBetLevel = 0;
  
  for (let i = 0; i < sortedBets.length; i++) {
    const currentBetLevel = sortedBets[i].bet;
    
    if (currentBetLevel === previousBetLevel) {
      continue;
    }
    
    const betDifference = currentBetLevel - previousBetLevel;
    const potAmount = betDifference * remainingPlayers.length;
    
    console.log(`Level ${i}: betDifference=${betDifference}, remainingPlayers=${remainingPlayers.length}, potAmount=${potAmount}`);
    
    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayers: [...remainingPlayers]
      });
    }
    
    // FIXED: Always remove current player
    remainingPlayers = remainingPlayers.filter(id => id !== sortedBets[i].playerId);
    
    previousBetLevel = currentBetLevel;
  }
  
  return pots;
}

const playerBets = [
  { playerId: 1, bet: 100, status: 'active' },
  { playerId: 2, bet: 200, status: 'active' },
  { playerId: 3, bet: 300, status: 'active' }
];

console.log('Player bets:', playerBets);
const pots = calculatePots(playerBets);
console.log('Calculated pots:', pots);

const totalPot = pots.reduce((sum, pot) => sum + pot.amount, 0);
console.log('Total pot:', totalPot);
console.log('Expected total:', 100 + 200 + 300);
