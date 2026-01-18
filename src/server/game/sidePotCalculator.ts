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
  let previousBetLevel = 0;
  
  for (let i = 0; i < sortedBets.length; i++) {
    const currentBetLevel = sortedBets[i].bet;
    
    // Skip if this player has the same bet as previous
    if (currentBetLevel === previousBetLevel) {
      continue;
    }
    
    // Calculate pot amount for this level
    const betDifference = currentBetLevel - previousBetLevel;
    
    // CRITICAL FIX: Only include players who bet >= currentBetLevel
    // This ensures side pots only include players who actually contributed
    const eligiblePlayers = activeBets
      .filter(p => p.bet >= currentBetLevel)
      .map(p => p.playerId);
    
    const potAmount = betDifference * eligiblePlayers.length;
    
    if (potAmount > 0) {
      pots.push({
        amount: potAmount,
        eligiblePlayers: [...eligiblePlayers]
      });
    }
    
    previousBetLevel = currentBetLevel;
  }
  
  return pots;
}

/**
 * Example usage:
 * 
 * Example 1: Simple all-in
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
 *   { amount: 300, eligiblePlayers: [1, 2, 3] },  // Main pot: 100 × 3
 *   { amount: 200, eligiblePlayers: [2, 3] }      // Side pot: (200-100) × 2
 * ]
 * Total: 300 + 200 = 500 (matches 100 + 200 + 200)
 * 
 * Example 2: Multiple small bets vs one large bet
 * Player A: 80 chips
 * Player B: 80 chips
 * Player C: 980 chips
 * 
 * calculatePots([
 *   { playerId: 1, bet: 80, status: 'active' },
 *   { playerId: 2, bet: 80, status: 'active' },
 *   { playerId: 3, bet: 980, status: 'active' }
 * ])
 * 
 * Returns:
 * [
 *   { amount: 240, eligiblePlayers: [1, 2, 3] },  // Main pot: 80 × 3
 *   { amount: 900, eligiblePlayers: [3] }         // Side pot: (980-80) × 1
 * ]
 * Total: 240 + 900 = 1140 (matches 80 + 80 + 980)
 */
