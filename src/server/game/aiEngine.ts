// AI Engine for Poker Game
// Implements different difficulty levels and decision-making logic

interface Card {
  suit: string;
  rank: string;
}

interface GameState {
  pot: number;
  currentBet: number;
  playerChips: number;
  playerBet: number;
  communityCards: Card[];
  holeCards: Card[];
  phase: string;
  playersRemaining: number;
}

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export class AIEngine {
  private difficulty: AIDifficulty;

  constructor(difficulty: AIDifficulty) {
    this.difficulty = difficulty;
  }

  // Main decision-making function
  public decideAction(gameState: GameState): { action: string; amount: number } {
    const handStrength = this.evaluateHand(gameState.holeCards, gameState.communityCards);
    const potOdds = this.calculatePotOdds(gameState);
    
    switch (this.difficulty) {
      case 'easy':
        return this.easyStrategy(gameState, handStrength);
      case 'medium':
        return this.mediumStrategy(gameState, handStrength, potOdds);
      case 'hard':
        return this.hardStrategy(gameState, handStrength, potOdds);
      default:
        return this.easyStrategy(gameState, handStrength);
    }
  }

  // Easy AI: Random decisions with basic hand awareness
  private easyStrategy(gameState: GameState, handStrength: number): { action: string; amount: number } {
    const callAmount = gameState.currentBet - gameState.playerBet;
    
    // Very weak hand (< 0.3): mostly fold
    if (handStrength < 0.3) {
      if (callAmount === 0) return { action: 'check', amount: 0 };
      return Math.random() < 0.2 ? { action: 'call', amount: callAmount } : { action: 'fold', amount: 0 };
    }
    
    // Medium hand (0.3-0.6): call or check
    if (handStrength < 0.6) {
      if (callAmount === 0) return { action: 'check', amount: 0 };
      return Math.random() < 0.6 ? { action: 'call', amount: callAmount } : { action: 'fold', amount: 0 };
    }
    
    // Strong hand (> 0.6): call or small raise
    if (callAmount === 0) {
      return Math.random() < 0.3 ? { action: 'raise', amount: gameState.pot * 0.3 } : { action: 'check', amount: 0 };
    }
    
    if (Math.random() < 0.7) {
      return { action: 'call', amount: callAmount };
    } else {
      return { action: 'raise', amount: callAmount + gameState.pot * 0.3 };
    }
  }

  // Medium AI: Considers hand strength and pot odds
  private mediumStrategy(gameState: GameState, handStrength: number, potOdds: number): { action: string; amount: number } {
    const callAmount = gameState.currentBet - gameState.playerBet;
    const potSize = gameState.pot;
    
    // Weak hand
    if (handStrength < 0.4) {
      if (callAmount === 0) return { action: 'check', amount: 0 };
      if (callAmount < potSize * 0.2 && handStrength > 0.25) {
        return { action: 'call', amount: callAmount };
      }
      return { action: 'fold', amount: 0 };
    }
    
    // Medium hand
    if (handStrength < 0.7) {
      if (callAmount === 0) {
        return Math.random() < 0.4 ? { action: 'raise', amount: potSize * 0.5 } : { action: 'check', amount: 0 };
      }
      if (callAmount < potSize * 0.5) {
        return { action: 'call', amount: callAmount };
      }
      return Math.random() < 0.3 ? { action: 'call', amount: callAmount } : { action: 'fold', amount: 0 };
    }
    
    // Strong hand
    if (callAmount === 0) {
      return { action: 'raise', amount: potSize * 0.7 };
    }
    if (Math.random() < 0.8) {
      return { action: 'raise', amount: callAmount + potSize * 0.7 };
    }
    return { action: 'call', amount: callAmount };
  }

  // Hard AI: Advanced strategy with position and aggression
  private hardStrategy(gameState: GameState, handStrength: number, potOdds: number): { action: string; amount: number } {
    const callAmount = gameState.currentBet - gameState.playerBet;
    const potSize = gameState.pot;
    const isLatePhase = ['turn', 'river'].includes(gameState.phase);
    
    // Calculate aggression factor based on hand strength and phase
    const aggressionFactor = this.calculateAggression(handStrength, gameState.phase, gameState.playersRemaining);
    
    // Very weak hand
    if (handStrength < 0.35) {
      if (callAmount === 0) {
        // Bluff occasionally in late position
        if (Math.random() < 0.15 && gameState.playersRemaining <= 3) {
          return { action: 'raise', amount: potSize * 0.6 };
        }
        return { action: 'check', amount: 0 };
      }
      // Fold to any significant bet
      if (callAmount > potSize * 0.3) {
        return { action: 'fold', amount: 0 };
      }
      // Call small bets with pot odds
      if (potOdds > 3 && handStrength > 0.25) {
        return { action: 'call', amount: callAmount };
      }
      return { action: 'fold', amount: 0 };
    }
    
    // Medium hand
    if (handStrength < 0.7) {
      if (callAmount === 0) {
        if (aggressionFactor > 0.6) {
          return { action: 'raise', amount: potSize * (0.5 + aggressionFactor * 0.3) };
        }
        return Math.random() < 0.5 ? { action: 'raise', amount: potSize * 0.5 } : { action: 'check', amount: 0 };
      }
      
      // Smart calling based on pot odds and hand strength
      if (callAmount < potSize * 0.6) {
        if (Math.random() < aggressionFactor) {
          return { action: 'raise', amount: callAmount + potSize * 0.6 };
        }
        return { action: 'call', amount: callAmount };
      }
      
      // Fold to large bets unless hand is strong enough
      if (handStrength > 0.6 && potOdds > 2) {
        return { action: 'call', amount: callAmount };
      }
      return { action: 'fold', amount: 0 };
    }
    
    // Strong hand - maximize value
    if (callAmount === 0) {
      // Slow play occasionally with very strong hands
      if (handStrength > 0.9 && Math.random() < 0.2 && !isLatePhase) {
        return { action: 'check', amount: 0 };
      }
      return { action: 'raise', amount: potSize * (0.7 + aggressionFactor * 0.5) };
    }
    
    // Always raise with strong hands
    if (Math.random() < 0.85) {
      const raiseAmount = Math.min(
        callAmount + potSize * (0.8 + aggressionFactor * 0.4),
        gameState.playerChips
      );
      return { action: 'raise', amount: raiseAmount };
    }
    return { action: 'call', amount: callAmount };
  }

  // Calculate aggression factor based on game state
  private calculateAggression(handStrength: number, phase: string, playersRemaining: number): number {
    let aggression = handStrength;
    
    // More aggressive in later phases
    if (phase === 'turn') aggression *= 1.1;
    if (phase === 'river') aggression *= 1.2;
    
    // More aggressive with fewer players
    if (playersRemaining <= 3) aggression *= 1.15;
    if (playersRemaining === 2) aggression *= 1.25;
    
    return Math.min(aggression, 1.0);
  }

  // Evaluate hand strength (0-1 scale)
  private evaluateHand(holeCards: Card[], communityCards: Card[]): number {
    const allCards = [...holeCards, ...communityCards];
    
    if (allCards.length < 2) return 0.3; // Preflop default
    
    const rankValues: { [key: string]: number } = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    
    // Count ranks and suits
    const rankCounts: { [key: number]: number } = {};
    const suitCounts: { [key: string]: number } = {};
    
    allCards.forEach(card => {
      const rankValue = rankValues[card.rank];
      rankCounts[rankValue] = (rankCounts[rankValue] || 0) + 1;
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    });
    
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    const maxSuitCount = Math.max(...Object.values(suitCounts));
    
    // Check for pairs, trips, quads
    if (counts[0] === 4) return 0.95; // Four of a kind
    if (counts[0] === 3 && counts[1] === 2) return 0.90; // Full house
    if (counts[0] === 3) return 0.75; // Three of a kind
    if (counts[0] === 2 && counts[1] === 2) return 0.65; // Two pair
    if (counts[0] === 2) return 0.50; // One pair
    
    // Check for flush
    if (maxSuitCount >= 5) return 0.85;
    
    // Check for straight potential
    const uniqueRanks = Object.keys(rankCounts).map(Number).sort((a, b) => a - b);
    let straightLength = 1;
    let maxStraightLength = 1;
    
    for (let i = 1; i < uniqueRanks.length; i++) {
      if (uniqueRanks[i] === uniqueRanks[i - 1] + 1) {
        straightLength++;
        maxStraightLength = Math.max(maxStraightLength, straightLength);
      } else {
        straightLength = 1;
      }
    }
    
    if (maxStraightLength >= 5) return 0.80; // Straight
    if (maxStraightLength === 4) return 0.55; // Straight draw
    
    // High card evaluation
    const highCard = Math.max(...uniqueRanks);
    const highCardStrength = (highCard - 2) / 12; // Normalize to 0-1
    
    // Preflop: evaluate hole cards
    if (communityCards.length === 0) {
      const holeRanks = holeCards.map(c => rankValues[c.rank]).sort((a, b) => b - a);
      const isPair = holeRanks[0] === holeRanks[1];
      const isSuited = holeCards[0].suit === holeCards[1].suit;
      const isHighCards = holeRanks[0] >= 11 && holeRanks[1] >= 11;
      
      if (isPair && holeRanks[0] >= 10) return 0.85; // High pocket pair
      if (isPair) return 0.60 + (holeRanks[0] / 14) * 0.2; // Lower pocket pair
      if (isHighCards && isSuited) return 0.70;
      if (isHighCards) return 0.60;
      if (isSuited) return 0.45 + highCardStrength * 0.15;
      return 0.30 + highCardStrength * 0.15;
    }
    
    return 0.30 + highCardStrength * 0.2;
  }

  // Calculate pot odds
  private calculatePotOdds(gameState: GameState): number {
    const callAmount = gameState.currentBet - gameState.playerBet;
    if (callAmount === 0) return Infinity;
    return gameState.pot / callAmount;
  }

  // Generate AI name based on difficulty
  public static generateAIName(difficulty: AIDifficulty, index: number): string {
    const easyNames = ['ビギナー', 'ルーキー', 'アマチュア', 'カジュアル'];
    const mediumNames = ['セミプロ', 'エキスパート', 'ベテラン', 'プレイヤー'];
    const hardNames = ['マスター', 'プロ', 'チャンピオン', 'レジェンド'];
    
    let names: string[];
    switch (difficulty) {
      case 'easy':
        names = easyNames;
        break;
      case 'medium':
        names = mediumNames;
        break;
      case 'hard':
        names = hardNames;
        break;
    }
    
    return `${names[index % names.length]}${index + 1}`;
  }
}
