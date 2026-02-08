/**
 * Tests for type guard utilities
 */

const { isDefined, isNonEmptyString, isNonEmptyArray } = require('../lib/utils');

console.log('Running type guard tests...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// isDefined tests
test('isDefined: returns false for null', () => {
  assert(isDefined(null) === false, 'null should not be defined');
});

test('isDefined: returns false for undefined', () => {
  assert(isDefined(undefined) === false, 'undefined should not be defined');
});

test('isDefined: returns true for 0', () => {
  assert(isDefined(0) === true, '0 should be defined');
});

test('isDefined: returns true for empty string', () => {
  assert(isDefined('') === true, 'empty string should be defined');
});

test('isDefined: returns true for false', () => {
  assert(isDefined(false) === true, 'false should be defined');
});

test('isDefined: returns true for object', () => {
  assert(isDefined({}) === true, 'object should be defined');
});

test('isDefined: returns true for array', () => {
  assert(isDefined([]) === true, 'array should be defined');
});

// isNonEmptyString tests
test('isNonEmptyString: returns false for null', () => {
  assert(isNonEmptyString(null) === false, 'null is not a non-empty string');
});

test('isNonEmptyString: returns false for undefined', () => {
  assert(isNonEmptyString(undefined) === false, 'undefined is not a non-empty string');
});

test('isNonEmptyString: returns false for number', () => {
  assert(isNonEmptyString(123) === false, 'number is not a non-empty string');
});

test('isNonEmptyString: returns false for empty string', () => {
  assert(isNonEmptyString('') === false, 'empty string is not a non-empty string');
});

test('isNonEmptyString: returns false for whitespace-only string', () => {
  assert(isNonEmptyString('   ') === false, 'whitespace-only string is not a non-empty string');
});

test('isNonEmptyString: returns false for tab-only string', () => {
  assert(isNonEmptyString('\t\t') === false, 'tab-only string is not a non-empty string');
});

test('isNonEmptyString: returns false for newline-only string', () => {
  assert(isNonEmptyString('\n\n') === false, 'newline-only string is not a non-empty string');
});

test('isNonEmptyString: returns true for non-empty string', () => {
  assert(isNonEmptyString('hello') === true, 'non-empty string should be valid');
});

test('isNonEmptyString: returns true for string with leading/trailing whitespace', () => {
  assert(isNonEmptyString('  hello  ') === true, 'string with content should be valid');
});

test('isNonEmptyString: returns true for single character', () => {
  assert(isNonEmptyString('a') === true, 'single character should be valid');
});

// isNonEmptyArray tests
test('isNonEmptyArray: returns false for null', () => {
  assert(isNonEmptyArray(null) === false, 'null is not a non-empty array');
});

test('isNonEmptyArray: returns false for undefined', () => {
  assert(isNonEmptyArray(undefined) === false, 'undefined is not a non-empty array');
});

test('isNonEmptyArray: returns false for string', () => {
  assert(isNonEmptyArray('test') === false, 'string is not a non-empty array');
});

test('isNonEmptyArray: returns false for object', () => {
  assert(isNonEmptyArray({}) === false, 'object is not a non-empty array');
});

test('isNonEmptyArray: returns false for empty array', () => {
  assert(isNonEmptyArray([]) === false, 'empty array is not a non-empty array');
});

test('isNonEmptyArray: returns true for array with one element', () => {
  assert(isNonEmptyArray([1]) === true, 'array with one element should be valid');
});

test('isNonEmptyArray: returns true for array with multiple elements', () => {
  assert(isNonEmptyArray([1, 2, 3]) === true, 'array with multiple elements should be valid');
});

test('isNonEmptyArray: returns true for array with null elements', () => {
  assert(isNonEmptyArray([null, null]) === true, 'array with null elements should be valid');
});

test('isNonEmptyArray: returns true for array with mixed types', () => {
  assert(isNonEmptyArray([1, 'test', null, {}]) === true, 'array with mixed types should be valid');
});

// Edge cases with combinations
test('Edge case: distinguishes between 0 and null', () => {
  assert(isDefined(0) === true && isDefined(null) === false, '0 should be defined but null should not');
});

test('Edge case: distinguishes between empty string and null', () => {
  assert(isDefined('') === true && isDefined(null) === false, 'empty string should be defined but null should not');
});

test('Edge case: distinguishes between false and undefined', () => {
  assert(isDefined(false) === true && isDefined(undefined) === false, 'false should be defined but undefined should not');
});

test('Edge case: isNonEmptyString with mixed whitespace', () => {
  assert(isNonEmptyString(' \t\n ') === false, 'mixed whitespace should not be a non-empty string');
});

test('Edge case: isNonEmptyString with content and whitespace', () => {
  assert(isNonEmptyString(' a ') === true, 'string with content should be valid even with whitespace');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
