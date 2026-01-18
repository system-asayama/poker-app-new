import { Card, HandRank, HandResult, Rank } from '@shared/types.js';

const rankValues: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const handRankValues: Record<HandRank, number> = {
  'high_card': 1,
  'one_pair': 2,
  'two_pair': 3,
  'three_of_a_kind': 4,
  'straight': 5,
  'flush': 6,
  'full_house': 7,
  'four_of_a_kind': 8,
  'straight_flush': 9,
  'royal_flush': 10,
};

export function evaluateHand(holeCards: Card[], communityCards: Card[]): HandResult {
  const allCards = [...holeCards, ...communityCards];
  const combinations = getCombinations(allCards, 5);
  
  let bestHand: HandResult | null = null;
  
  for (const combo of combinations) {
    const hand = evaluateFiveCards(combo);
    if (!bestHand || hand.value > bestHand.value) {
      bestHand = hand;
    }
  }
  
  return bestHand!;
}

function getCombinations(cards: Card[], size: number): Card[][] {
  if (size === 1) return cards.map(card => [card]);
  if (size === cards.length) return [cards];
  
  const combinations: Card[][] = [];
  for (let i = 0; i <= cards.length - size; i++) {
    const head = cards[i];
    const tailCombos = getCombinations(cards.slice(i + 1), size - 1);
    for (const combo of tailCombos) {
      combinations.push([head, ...combo]);
    }
  }
  return combinations;
}

function evaluateFiveCards(cards: Card[]): HandResult {
  const sortedCards = [...cards].sort((a, b) => rankValues[b.rank] - rankValues[a.rank]);
  
  const isFlush = cards.every(card => card.suit === cards[0].suit);
  const isStraight = checkStraight(sortedCards);
  const rankCounts = countRanks(sortedCards);
  
  // Royal Flush
  if (isFlush && isStraight && sortedCards[0].rank === 'A') {
    return {
      rank: 'royal_flush',
      cards: sortedCards,
      value: handRankValues.royal_flush * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // Straight Flush
  if (isFlush && isStraight) {
    return {
      rank: 'straight_flush',
      cards: sortedCards,
      value: handRankValues.straight_flush * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // Four of a Kind
  if (rankCounts.some(c => c.count === 4)) {
    return {
      rank: 'four_of_a_kind',
      cards: sortedCards,
      value: handRankValues.four_of_a_kind * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // Full House
  if (rankCounts.some(c => c.count === 3) && rankCounts.some(c => c.count === 2)) {
    return {
      rank: 'full_house',
      cards: sortedCards,
      value: handRankValues.full_house * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // Flush
  if (isFlush) {
    return {
      rank: 'flush',
      cards: sortedCards,
      value: handRankValues.flush * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // Straight
  if (isStraight) {
    return {
      rank: 'straight',
      cards: sortedCards,
      value: handRankValues.straight * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // Three of a Kind
  if (rankCounts.some(c => c.count === 3)) {
    return {
      rank: 'three_of_a_kind',
      cards: sortedCards,
      value: handRankValues.three_of_a_kind * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // Two Pair
  if (rankCounts.filter(c => c.count === 2).length === 2) {
    return {
      rank: 'two_pair',
      cards: sortedCards,
      value: handRankValues.two_pair * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // One Pair
  if (rankCounts.some(c => c.count === 2)) {
    return {
      rank: 'one_pair',
      cards: sortedCards,
      value: handRankValues.one_pair * 1000000 + getHighCardValue(sortedCards),
    };
  }
  
  // High Card
  return {
    rank: 'high_card',
    cards: sortedCards,
    value: handRankValues.high_card * 1000000 + getHighCardValue(sortedCards),
  };
}

function checkStraight(sortedCards: Card[]): boolean {
  const values = sortedCards.map(card => rankValues[card.rank]);
  
  // Check regular straight
  let isRegularStraight = true;
  for (let i = 0; i < values.length - 1; i++) {
    if (values[i] - values[i + 1] !== 1) {
      isRegularStraight = false;
      break;
    }
  }
  
  if (isRegularStraight) {
    return true;
  }
  
  // Check for A-2-3-4-5 straight (wheel)
  const ranks = sortedCards.map(c => c.rank).sort();
  const wheelRanks = ['2', '3', '4', '5', 'A'];
  if (ranks.length === 5 && ranks.every((rank, i) => rank === wheelRanks[i])) {
    return true;
  }
  
  return false;
}

function countRanks(cards: Card[]): { rank: Rank; count: number }[] {
  const counts = new Map<Rank, number>();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || rankValues[b.rank] - rankValues[a.rank]);
}

function getHighCardValue(cards: Card[]): number {
  return cards.reduce((sum, card, index) => {
    return sum + rankValues[card.rank] * Math.pow(15, 4 - index);
  }, 0);
}

export function compareHands(hand1: HandResult, hand2: HandResult): number {
  return hand1.value - hand2.value;
}
