/**
 * Side Pot Calculator
 * Handles calculation of main pot and side pots when players go all-in
 */

export interface PlayerBet {
  playerId: number;
  bet: number;
  status: 'active' | 'folded' | 'allin' | 'out';
}

export interface Pot {
  amount: number;
  eligiblePlayers: number[]; // Player IDs who can win this pot
}

/**
 * Calculate pots based on player bets
 * Returns array of pots: [mainPot, sidePot1, sidePot2, ...]
 */
export function calculatePots(playerBets: PlayerBet[]): Pot[] {
  // Filter out folded players
  const activeBets = playerBets.filter(p => p.status !== 'folded');
  
  if (activeBets.length === 0) {
    return [];
  }
  
  // Sort by bet amount (ascending)
  const sortedBets = [...activeBets].sort((a, b) => a.bet - b.bet);
  
  const pots: Pot[] = [];
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

/**
 * Example usage:
 * 
 * Player A: 100 chips (all-in)
 * Player B: 200 chips (bet)
 * Player C: 200 chips (bet)
 * 
 * calculatePots([
 *   { playerId: 1, bet: 100, status: 'allin' },
 *   { playerId: 2, bet: 200, status: 'active' },
 *   { playerId: 3, bet: 200, status: 'active' }
 * ])
 * 
 * Returns:
 * [
 *   { amount: 300, eligiblePlayers: [1, 2, 3] },  // Main pot
 *   { amount: 200, eligiblePlayers: [2, 3] }      // Side pot
 * ]
 */
