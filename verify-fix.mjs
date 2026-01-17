// Verify the fix for hand evaluation

const rankValues = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
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

function getHighCardValueOld(cards) {
  return cards.reduce((sum, card, index) => {
    return sum + rankValues[card.rank] * Math.pow(100, 4 - index);
  }, 0);
}

function getHighCardValueNew(cards) {
  return cards.reduce((sum, card, index) => {
    return sum + rankValues[card.rank] * Math.pow(15, 4 - index);
  }, 0);
}

// Game 67 scenario
console.log('=== Game 67 Hand Evaluation ===\n');

// Community: 5♦ K♦ 9♣ 7♦ 10♠
const community = [
  { rank: '5', suit: 'diamonds' },
  { rank: 'K', suit: 'diamonds' },
  { rank: '9', suit: 'clubs' },
  { rank: '7', suit: 'diamonds' },
  { rank: '10', suit: 'spades' }
];

// 浅山: 5♠ K♥ → Two Pair (K-K-5-5)
const asayama = [
  { rank: 'K', suit: 'hearts' },
  { rank: 'K', suit: 'diamonds' },
  { rank: '10', suit: 'spades' },
  { rank: '9', suit: 'clubs' },
  { rank: '7', suit: 'diamonds' }
];

// Expert 2: 4♥ A♦ → High Card
const expert2 = [
  { rank: 'A', suit: 'diamonds' },
  { rank: 'K', suit: 'diamonds' },
  { rank: '10', suit: 'spades' },
  { rank: '9', suit: 'clubs' },
  { rank: '7', suit: 'diamonds' }
];

// Player 4: K♠ Q♥ → One Pair (K-K)
const player4 = [
  { rank: 'K', suit: 'spades' },
  { rank: 'K', suit: 'diamonds' },
  { rank: 'Q', suit: 'hearts' },
  { rank: '10', suit: 'spades' },
  { rank: '9', suit: 'clubs' }
];

console.log('浅山 (Two Pair K-K-5-5):');
const asayamaOld = handRankValues.two_pair * 1000000 + getHighCardValueOld(asayama);
const asayamaNew = handRankValues.two_pair * 1000000 + getHighCardValueNew(asayama);
console.log(`  OLD: ${asayamaOld.toLocaleString()}`);
console.log(`  NEW: ${asayamaNew.toLocaleString()}`);
console.log('');

console.log('Expert 2 (High Card A):');
const expert2Old = handRankValues.high_card * 1000000 + getHighCardValueOld(expert2);
const expert2New = handRankValues.high_card * 1000000 + getHighCardValueNew(expert2);
console.log(`  OLD: ${expert2Old.toLocaleString()}`);
console.log(`  NEW: ${expert2New.toLocaleString()}`);
console.log('');

console.log('Player 4 (One Pair K-K):');
const player4Old = handRankValues.one_pair * 1000000 + getHighCardValueOld(player4);
const player4New = handRankValues.one_pair * 1000000 + getHighCardValueNew(player4);
console.log(`  OLD: ${player4Old.toLocaleString()}`);
console.log(`  NEW: ${player4New.toLocaleString()}`);
console.log('');

console.log('=== OLD LOGIC (BROKEN) ===');
const oldValues = [
  { name: '浅山 (Two Pair)', value: asayamaOld },
  { name: 'Expert 2 (High Card)', value: expert2Old },
  { name: 'Player 4 (One Pair)', value: player4Old }
];
oldValues.sort((a, b) => b.value - a.value);
console.log('Winner:', oldValues[0].name);
console.log('');

console.log('=== NEW LOGIC (FIXED) ===');
const newValues = [
  { name: '浅山 (Two Pair)', value: asayamaNew },
  { name: 'Expert 2 (High Card)', value: expert2New },
  { name: 'Player 4 (One Pair)', value: player4New }
];
newValues.sort((a, b) => b.value - a.value);
console.log('Winner:', newValues[0].name);
console.log('');

console.log('=== ANALYSIS ===');
console.log('Max high card value (OLD):', 14 * Math.pow(100, 4));
console.log('Max high card value (NEW):', 14 * Math.pow(15, 4));
console.log('Hand rank multiplier:', 1000000);
console.log('');
console.log('OLD: High card can exceed hand rank? YES (1,400,000,000 > 1,000,000)');
console.log('NEW: High card can exceed hand rank? NO (708,750 < 1,000,000)');
