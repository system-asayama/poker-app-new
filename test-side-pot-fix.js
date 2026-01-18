// Test the fixed calculatePots function

function calculatePots(playerBets) {
  // Filter out folded players
  const activeBets = playerBets.filter(p => p.status !== 'folded');
  
  if (activeBets.length === 0) {
    return [];
  }
  
  // Sort by bet amount (ascending)
  const sortedBets = [...activeBets].sort((a, b) => a.bet - b.bet);
  
  const pots = [];
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

console.log('=== Test Case 1: Simple all-in (100, 200, 200) ===');
const test1 = [
  { playerId: 1, bet: 100, status: 'allin' },
  { playerId: 2, bet: 200, status: 'active' },
  { playerId: 3, bet: 200, status: 'active' }
];
const result1 = calculatePots(test1);
console.log('Input:', test1.map(p => ({ id: p.playerId, bet: p.bet })));
console.log('Pots:', result1);
const total1 = result1.reduce((sum, pot) => sum + pot.amount, 0);
const expected1 = test1.reduce((sum, p) => sum + p.bet, 0);
console.log(`Total pot: ${total1}, Expected: ${expected1}, Match: ${total1 === expected1 ? '✓' : '✗'}`);
console.log('');

console.log('=== Test Case 2: Multiple small bets vs large bet (80, 80, 980) ===');
const test2 = [
  { playerId: 1, bet: 80, status: 'active' },
  { playerId: 2, bet: 80, status: 'active' },
  { playerId: 3, bet: 980, status: 'active' }
];
const result2 = calculatePots(test2);
console.log('Input:', test2.map(p => ({ id: p.playerId, bet: p.bet })));
console.log('Pots:', result2);
const total2 = result2.reduce((sum, pot) => sum + pot.amount, 0);
const expected2 = test2.reduce((sum, p) => sum + p.bet, 0);
console.log(`Total pot: ${total2}, Expected: ${expected2}, Match: ${total2 === expected2 ? '✓' : '✗'}`);
console.log('');

console.log('=== Test Case 3: From logs (20, 980, 0) - player 3 folded ===');
const test3 = [
  { playerId: 1, bet: 20, status: 'active' },
  { playerId: 2, bet: 980, status: 'active' },
  { playerId: 3, bet: 0, status: 'folded' }
];
const result3 = calculatePots(test3);
console.log('Input:', test3.map(p => ({ id: p.playerId, bet: p.bet, status: p.status })));
console.log('Pots:', result3);
const total3 = result3.reduce((sum, pot) => sum + pot.amount, 0);
const expected3 = test3.filter(p => p.status !== 'folded').reduce((sum, p) => sum + p.bet, 0);
console.log(`Total pot: ${total3}, Expected: ${expected3}, Match: ${total3 === expected3 ? '✓' : '✗'}`);
console.log('');

console.log('=== Test Case 4: Three different bet levels (100, 200, 300) ===');
const test4 = [
  { playerId: 1, bet: 100, status: 'allin' },
  { playerId: 2, bet: 200, status: 'allin' },
  { playerId: 3, bet: 300, status: 'active' }
];
const result4 = calculatePots(test4);
console.log('Input:', test4.map(p => ({ id: p.playerId, bet: p.bet })));
console.log('Pots:', result4);
const total4 = result4.reduce((sum, pot) => sum + pot.amount, 0);
const expected4 = test4.reduce((sum, p) => sum + p.bet, 0);
console.log(`Total pot: ${total4}, Expected: ${expected4}, Match: ${total4 === expected4 ? '✓' : '✗'}`);
console.log('');

console.log('=== Test Case 5: All same bet (100, 100, 100) ===');
const test5 = [
  { playerId: 1, bet: 100, status: 'active' },
  { playerId: 2, bet: 100, status: 'active' },
  { playerId: 3, bet: 100, status: 'active' }
];
const result5 = calculatePots(test5);
console.log('Input:', test5.map(p => ({ id: p.playerId, bet: p.bet })));
console.log('Pots:', result5);
const total5 = result5.reduce((sum, pot) => sum + pot.amount, 0);
const expected5 = test5.reduce((sum, p) => sum + p.bet, 0);
console.log(`Total pot: ${total5}, Expected: ${expected5}, Match: ${total5 === expected5 ? '✓' : '✗'}`);
console.log('');

console.log('=== Summary ===');
const allTests = [
  { name: 'Test 1', total: total1, expected: expected1 },
  { name: 'Test 2', total: total2, expected: expected2 },
  { name: 'Test 3', total: total3, expected: expected3 },
  { name: 'Test 4', total: total4, expected: expected4 },
  { name: 'Test 5', total: total5, expected: expected5 }
];

const passed = allTests.filter(t => t.total === t.expected).length;
console.log(`Passed: ${passed}/${allTests.length}`);
if (passed === allTests.length) {
  console.log('✓ All tests passed!');
} else {
  console.log('✗ Some tests failed');
  allTests.forEach(t => {
    if (t.total !== t.expected) {
      console.log(`  ${t.name}: ${t.total} !== ${t.expected}`);
    }
  });
}
