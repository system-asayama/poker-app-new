import { Card, HandRank } from '@shared/types.js';
import { evaluateHand } from './handEvaluator.js';

interface HandProbability {
  handRank: HandRank;
  probability: number;
  outs: number;
}

interface WinProbability {
  winRate: number;
  tieRate: number;
  loseRate: number;
}

interface HandAnalysis {
  currentHand: {
    rank: HandRank;
    value: number;
  } | null;
  probabilities: HandProbability[];
  winProbability: WinProbability;
}

/**
 * Calculate the probability of making each hand type
 */
export function calculateHandProbabilities(
  holeCards: Card[],
  communityCards: Card[],
  deck: Card[]
): HandProbability[] {
  const cardsNeeded = 5 - communityCards.length;
  
  if (cardsNeeded <= 0) {
    // All community cards are dealt, no more probabilities to calculate
    return [];
  }
  
  // Count how many remaining cards would make each hand type
  const handCounts: Record<HandRank, number> = {
    'high_card': 0,
    'one_pair': 0,
    'two_pair': 0,
    'three_of_a_kind': 0,
    'straight': 0,
    'flush': 0,
    'full_house': 0,
    'four_of_a_kind': 0,
    'straight_flush': 0,
    'royal_flush': 0,
  };
  
  // Sample a subset of possible outcomes (for performance)
  const sampleSize = Math.min(1000, getCombinationCount(deck.length, cardsNeeded));
  const samples = sampleCombinations(deck, cardsNeeded, sampleSize);
  
  for (const sample of samples) {
    const finalCommunity = [...communityCards, ...sample];
    const hand = evaluateHand(holeCards, finalCommunity);
    handCounts[hand.rank]++;
  }
  
  // Convert counts to probabilities
  const probabilities: HandProbability[] = [];
  const totalSamples = samples.length;
  
  for (const [rank, count] of Object.entries(handCounts)) {
    if (count > 0) {
      probabilities.push({
        handRank: rank as HandRank,
        probability: count / totalSamples,
        outs: Math.round((count / totalSamples) * deck.length),
      });
    }
  }
  
  // Sort by probability (descending)
  probabilities.sort((a, b) => b.probability - a.probability);
  
  return probabilities;
}

/**
 * Calculate win probability using Monte Carlo simulation
 */
export function calculateWinProbability(
  holeCards: Card[],
  communityCards: Card[],
  deck: Card[],
  numOpponents: number
): WinProbability {
  const cardsNeeded = 5 - communityCards.length;
  
  if (cardsNeeded <= 0) {
    // All cards dealt, can't simulate
    return { winRate: 0, tieRate: 0, loseRate: 0 };
  }
  
  const simulations = 500; // Number of simulations
  let wins = 0;
  let ties = 0;
  let losses = 0;
  
  for (let i = 0; i < simulations; i++) {
    // Shuffle deck and deal remaining community cards
    const shuffled = [...deck];
    shuffle(shuffled);
    
    const finalCommunity = [...communityCards, ...shuffled.slice(0, cardsNeeded)];
    const myHand = evaluateHand(holeCards, finalCommunity);
    
    // Simulate opponent hands
    let remainingCards = shuffled.slice(cardsNeeded);
    let bestOpponentValue = 0;
    
    for (let j = 0; j < numOpponents; j++) {
      if (remainingCards.length < 2) break;
      
      const opponentHole = remainingCards.slice(0, 2);
      remainingCards = remainingCards.slice(2);
      
      const opponentHand = evaluateHand(opponentHole, finalCommunity);
      bestOpponentValue = Math.max(bestOpponentValue, opponentHand.value);
    }
    
    if (myHand.value > bestOpponentValue) {
      wins++;
    } else if (myHand.value === bestOpponentValue) {
      ties++;
    } else {
      losses++;
    }
  }
  
  return {
    winRate: wins / simulations,
    tieRate: ties / simulations,
    loseRate: losses / simulations,
  };
}

/**
 * Analyze a player's hand and return probabilities
 */
export function analyzeHand(
  holeCards: Card[],
  communityCards: Card[],
  deck: Card[],
  numOpponents: number
): HandAnalysis {
  // Current hand (if any community cards are dealt)
  let currentHand = null;
  if (communityCards.length > 0) {
    currentHand = evaluateHand(holeCards, communityCards);
  }
  
  // Calculate probabilities for future hands
  const probabilities = calculateHandProbabilities(holeCards, communityCards, deck);
  
  // Calculate win probability
  const winProbability = calculateWinProbability(holeCards, communityCards, deck, numOpponents);
  
  return {
    currentHand,
    probabilities,
    winProbability,
  };
}

// Helper functions

function getCombinationCount(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result *= (n - i + 1) / i;
  }
  return Math.round(result);
}

function sampleCombinations(cards: Card[], size: number, sampleSize: number): Card[][] {
  const samples: Card[][] = [];
  
  for (let i = 0; i < sampleSize; i++) {
    const shuffled = [...cards];
    shuffle(shuffled);
    samples.push(shuffled.slice(0, size));
  }
  
  return samples;
}

function shuffle(array: any[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
