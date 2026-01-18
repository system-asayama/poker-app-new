// Test hand evaluator with the specific case from the screenshot

const rankValues = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const handRankValues = {
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

function getHighCardValue(cards) {
  return cards.reduce((sum, card, index) => {
    return sum + rankValues[card.rank] * Math.pow(15, 4 - index);
  }, 0);
}

function countRanks(cards) {
  const counts = new Map();
  for (const card of cards) {
    counts.set(card.rank, (counts.get(card.rank) || 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([rank, count]) => ({ rank, count }))
    .sort((a, b) => b.count - a.count || rankValues[b.rank] - rankValues[a.rank]);
}

function evaluateOnePair(sortedCards) {
  const rankCounts = countRanks(sortedCards);
  const pairRank = rankCounts.find(c => c.count === 2).rank;
  const pairCards = sortedCards.filter(c => c.rank === pairRank);
  const kickers = sortedCards.filter(c => c.rank !== pairRank);
  const orderedCards = [...pairCards, ...kickers];
  
  return {
    rank: 'one_pair',
    cards: sortedCards,
    orderedCards,
    value: handRankValues.one_pair * 1000000 + getHighCardValue(orderedCards),
  };
}

// Test case from screenshot
console.log('=== Test Case: Screenshot Scenario ===');
console.log('Community Cards: 9♥ 5♦ K♦ J♥ 3♣');
console.log('');

// Player 1: なおたん - Q♦ 3♥
// Best 5 cards: K, Q, J, 9, 3 (with 3♥ from hole cards and 3♣ from community)
const player1 = [
  { rank: 'K', suit: 'diamonds' },
  { rank: 'Q', suit: 'diamonds' },
  { rank: 'J', suit: 'hearts' },
  { rank: '9', suit: 'hearts' },
  { rank: '3', suit: 'hearts' },  // from hole cards
  { rank: '3', suit: 'clubs' },   // from community
].sort((a, b) => rankValues[b.rank] - rankValues[a.rank]);
// Take best 5
const player1Best5 = [
  { rank: 'K', suit: 'diamonds' },
  { rank: 'Q', suit: 'diamonds' },
  { rank: 'J', suit: 'hearts' },
  { rank: '3', suit: 'hearts' },
  { rank: '3', suit: 'clubs' },
].sort((a, b) => rankValues[b.rank] - rankValues[a.rank]);

const player1Hand = evaluateOnePair(player1Best5);
console.log('Player 1 (なおたん): Q♦ 3♥ → One Pair (3s)');
console.log('  Sorted cards:', player1Best5.map(c => c.rank).join(', '));
console.log('  Ordered for value:', player1Hand.orderedCards.map(c => c.rank).join(', '));
console.log('  Value:', player1Hand.value);
console.log('');

// Player 2: セミプロ1 - 4♠ J♣
const player2 = [
  { rank: 'K', suit: 'diamonds' },
  { rank: 'J', suit: 'hearts' },
  { rank: 'J', suit: 'clubs' },
  { rank: '9', suit: 'hearts' },
  { rank: '5', suit: 'diamonds' },
].sort((a, b) => rankValues[b.rank] - rankValues[a.rank]);

const player2Hand = evaluateOnePair(player2);
console.log('Player 2 (セミプロ1): 4♠ J♣ → One Pair (Js)');
console.log('  Sorted cards:', player2.map(c => c.rank).join(', '));
console.log('  Ordered for value:', player2Hand.orderedCards.map(c => c.rank).join(', '));
console.log('  Value:', player2Hand.value);
console.log('');

// Player 3: エキスパート2 - 3♠ 2♠
const player3 = [
  { rank: 'K', suit: 'diamonds' },
  { rank: '9', suit: 'hearts' },
  { rank: '5', suit: 'diamonds' },
  { rank: '3', suit: 'spades' },  // from hole cards
  { rank: '3', suit: 'clubs' },   // from community
].sort((a, b) => rankValues[b.rank] - rankValues[a.rank]);

const player3Hand = evaluateOnePair(player3);
console.log('Player 3 (エキスパート2): 3♠ 2♠ → One Pair (3s)');
console.log('  Best 5 cards: K, 9, 5, 3♠, 3♣');
console.log('  Sorted cards:', player3.map(c => c.rank).join(', '));
console.log('  Ordered for value:', player3Hand.orderedCards.map(c => c.rank).join(', '));
console.log('  Value:', player3Hand.value);
console.log('');

// Compare
console.log('=== Comparison ===');
const players = [
  { name: 'なおたん', hand: player1Hand },
  { name: 'セミプロ1', hand: player2Hand },
  { name: 'エキスパート2', hand: player3Hand },
];

players.sort((a, b) => b.hand.value - a.hand.value);

console.log('Winner:', players[0].name);
console.log('Rankings:');
players.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.name} (value: ${p.hand.value})`);
});

if (players[0].name === 'セミプロ1') {
  console.log('\n✓ Correct! セミプロ1 should win with pair of Jacks');
} else {
  console.log('\n✗ Wrong! セミプロ1 should win, but', players[0].name, 'won');
}
