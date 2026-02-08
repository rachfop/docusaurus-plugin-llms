/**
 * Test Windows path normalization utility function
 * Tests the centralized normalizePath() function that handles Windows backslashes
 */

const fs = require('fs');
const path = require('path');
const { normalizePath } = require('../lib/utils');

console.log('Running Windows path normalization tests...\n');
console.log('='.repeat(80));
console.log('WINDOWS PATH NORMALIZATION TESTS');
console.log('='.repeat(80));

let testNumber = 0;
let passed = 0;
let failed = 0;

function runTest(description, input, expected) {
  testNumber++;
  console.log(`\nTest ${testNumber}: ${description}`);
  console.log(`  Input:    "${input}"`);
  console.log(`  Expected: "${expected}"`);

  const result = normalizePath(input);
  console.log(`  Result:   "${result}"`);

  if (result === expected) {
    console.log('  ✅ PASS');
    passed++;
  } else {
    console.log('  ❌ FAIL');
    failed++;
  }
}

// Test 1: Windows path with backslashes
runTest(
  'Windows path with backslashes should be normalized to forward slashes',
  'docs\\quickstart\\file.md',
  'docs/quickstart/file.md'
);

// Test 2: Unix path should remain unchanged
runTest(
  'Unix path with forward slashes should remain unchanged',
  'docs/quickstart/file.md',
  'docs/quickstart/file.md'
);

// Test 3: Mixed path separators
runTest(
  'Mixed path separators should all be normalized to forward slashes',
  'docs\\api/methods\\file.md',
  'docs/api/methods/file.md'
);

// Test 4: Single backslash
runTest(
  'Single backslash should be converted to forward slash',
  'docs\\file.md',
  'docs/file.md'
);

// Test 5: Multiple consecutive backslashes
runTest(
  'Multiple consecutive backslashes should be normalized',
  'docs\\\\api\\\\file.md',
  'docs//api//file.md'
);

// Test 6: Path with drive letter (Windows absolute path)
runTest(
  'Windows absolute path with drive letter',
  'C:\\Users\\docs\\file.md',
  'C:/Users/docs/file.md'
);

// Test 7: UNC path (Windows network path)
runTest(
  'Windows UNC path should be normalized',
  '\\\\server\\share\\docs\\file.md',
  '//server/share/docs/file.md'
);

// Test 8: Empty string
runTest(
  'Empty string should remain empty',
  '',
  ''
);

// Test 9: Single forward slash
runTest(
  'Single forward slash should remain unchanged',
  '/',
  '/'
);

// Test 10: Single backslash
runTest(
  'Single backslash should be converted to forward slash',
  '\\',
  '/'
);

// Test 11: Relative path with backslashes
runTest(
  'Relative path with backslashes',
  '..\\..\\docs\\file.md',
  '../../docs/file.md'
);

// Test 12: Path with spaces and backslashes
runTest(
  'Path with spaces and backslashes',
  'docs\\My Documents\\file.md',
  'docs/My Documents/file.md'
);

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Total tests: ${testNumber}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log('\n❌ Some tests failed');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed');
  process.exit(0);
}
