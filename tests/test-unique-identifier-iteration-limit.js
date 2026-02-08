/**
 * Test file for ensureUniqueIdentifier iteration limit
 * Tests the fix for Issue #6: Infinite Loop Risk in Unique Identifier Generation
 */

const { ensureUniqueIdentifier } = require('../lib/utils');

function runTests() {
  console.log('Testing ensureUniqueIdentifier iteration limit...\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Normal operation - should work as before
  try {
    const usedIds = new Set();
    const result1 = ensureUniqueIdentifier('test', usedIds);
    if (result1 !== 'test' || !usedIds.has('test')) {
      throw new Error(`Expected 'test', got '${result1}'`);
    }

    const result2 = ensureUniqueIdentifier('test', usedIds);
    if (result2 !== 'test(2)' || !usedIds.has('test(2)')) {
      throw new Error(`Expected 'test(2)', got '${result2}'`);
    }

    const result3 = ensureUniqueIdentifier('test', usedIds);
    if (result3 !== 'test(3)' || !usedIds.has('test(3)')) {
      throw new Error(`Expected 'test(3)', got '${result3}'`);
    }

    console.log('✓ Test 1: Normal operation works correctly');
    testsPassed++;
  } catch (error) {
    console.error('✗ Test 1 FAILED:', error.message);
    testsFailed++;
  }

  // Test 2: Custom suffix function
  try {
    const usedIds = new Set();
    const customSuffix = (counter) => `-${counter}`;

    const result1 = ensureUniqueIdentifier('test', usedIds, customSuffix);
    if (result1 !== 'test') {
      throw new Error(`Expected 'test', got '${result1}'`);
    }

    const result2 = ensureUniqueIdentifier('test', usedIds, customSuffix);
    if (result2 !== 'test-2') {
      throw new Error(`Expected 'test-2', got '${result2}'`);
    }

    console.log('✓ Test 2: Custom suffix function works correctly');
    testsPassed++;
  } catch (error) {
    console.error('✗ Test 2 FAILED:', error.message);
    testsFailed++;
  }

  // Test 3: Iteration limit with malfunctioning suffix
  // This simulates the bug scenario where suffix function returns same value
  try {
    const usedIds = new Set(['base']);
    const malfunctioningSuffix = () => ''; // Always returns empty string

    console.log('  Running iteration limit test (this should complete quickly)...');
    const start = Date.now();
    const result = ensureUniqueIdentifier('base', usedIds, malfunctioningSuffix);
    const duration = Date.now() - start;

    if (duration > 5000) {
      throw new Error(`Test took too long: ${duration}ms (possible infinite loop)`);
    }

    // Result should be a fallback with timestamp and random
    if (!result.includes('base-') || usedIds.size !== 2) {
      throw new Error(`Expected fallback identifier with 'base-', got '${result}'`);
    }

    console.log(`✓ Test 3: Iteration limit prevents infinite loop (completed in ${duration}ms)`);
    console.log(`  Fallback identifier: ${result}`);
    testsPassed++;
  } catch (error) {
    console.error('✗ Test 3 FAILED:', error.message);
    testsFailed++;
  }

  // Test 4: Suffix function that always returns same counter
  try {
    const usedIds = new Set(['test', 'test(999)']);
    const brokenSuffix = () => '(999)'; // Always returns same value

    const result = ensureUniqueIdentifier('test', usedIds, brokenSuffix);

    // Should fallback to timestamp-based identifier
    if (!result.includes('test-')) {
      throw new Error(`Expected fallback identifier, got '${result}'`);
    }

    console.log('✓ Test 4: Broken suffix function triggers fallback correctly');
    testsPassed++;
  } catch (error) {
    console.error('✗ Test 4 FAILED:', error.message);
    testsFailed++;
  }

  // Test 5: Case insensitivity check
  try {
    const usedIds = new Set();

    const result1 = ensureUniqueIdentifier('Test', usedIds);
    if (result1 !== 'Test' || !usedIds.has('test')) {
      throw new Error(`Expected 'Test' with lowercase 'test' in set, got '${result1}'`);
    }

    const result2 = ensureUniqueIdentifier('test', usedIds);
    if (result2 !== 'test(2)') {
      throw new Error(`Expected 'test(2)' due to case insensitivity, got '${result2}'`);
    }

    console.log('✓ Test 5: Case insensitivity works correctly');
    testsPassed++;
  } catch (error) {
    console.error('✗ Test 5 FAILED:', error.message);
    testsFailed++;
  }

  // Test 6: Large number of collisions (but under limit)
  try {
    const usedIds = new Set();
    // Pre-populate with test and 100 identifiers
    usedIds.add('test');
    for (let i = 2; i <= 101; i++) {
      usedIds.add(`test(${i})`.toLowerCase());
    }

    const result = ensureUniqueIdentifier('test', usedIds);
    if (result !== 'test(102)') {
      throw new Error(`Expected 'test(102)', got '${result}'`);
    }

    console.log('✓ Test 6: Handles large number of collisions (100+) correctly');
    testsPassed++;
  } catch (error) {
    console.error('✗ Test 6 FAILED:', error.message);
    testsFailed++;
  }

  // Test 7: Edge case - fallback identifier should also be added to used set
  try {
    const usedIds = new Set(['test']);
    const brokenSuffix = () => ''; // Always returns empty string

    const result = ensureUniqueIdentifier('test', usedIds, brokenSuffix);

    if (!usedIds.has(result.toLowerCase())) {
      throw new Error(`Fallback identifier '${result}' was not added to usedIdentifiers set`);
    }

    console.log('✓ Test 7: Fallback identifier is added to used set');
    testsPassed++;
  } catch (error) {
    console.error('✗ Test 7 FAILED:', error.message);
    testsFailed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
  console.log('='.repeat(50));

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
