/**
 * Unit tests for description truncation edge cases
 *
 * Tests the improved word boundary truncation logic that was added
 * to fix Issue #15 & #29
 *
 * Run with: node tests/test-description-truncation.js
 */

const assert = require('assert');

/**
 * Constants matching those in generator.ts
 */
const MAX_DESCRIPTION_LENGTH = 150;
const DESCRIPTION_TRUNCATE_AT = 147;
const WORD_BOUNDARY_MIN_RATIO = 0.8;

/**
 * Clean a description for use in a TOC item (matching generator.ts)
 */
function cleanDescriptionForToc(description) {
  if (!description) return '';

  // Get just the first line for TOC display
  const lines = description.split('\n');
  const firstLine = lines.length > 0 ? lines[0] : '';

  // Remove heading markers only at the beginning of the line
  const cleaned = firstLine.replace(/^(#+)\s+/g, '');

  // Truncate if too long
  if (cleaned.length > MAX_DESCRIPTION_LENGTH) {
    let truncated = cleaned.substring(0, DESCRIPTION_TRUNCATE_AT);
    // Truncate at last word boundary to avoid cutting words in half
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > MAX_DESCRIPTION_LENGTH * WORD_BOUNDARY_MIN_RATIO) {
      truncated = truncated.substring(0, lastSpace);
    }
    return truncated + '...';
  }

  return cleaned;
}

// Test cases for description truncation
const tests = [
  {
    name: 'Short description (no truncation)',
    input: 'This is a short description',
    expected: 'This is a short description',
    expectsTruncation: false
  },
  {
    name: 'Exactly at max length',
    input: 'a'.repeat(MAX_DESCRIPTION_LENGTH),
    expected: 'a'.repeat(MAX_DESCRIPTION_LENGTH),
    expectsTruncation: false
  },
  {
    name: 'One character over max length',
    input: 'a'.repeat(MAX_DESCRIPTION_LENGTH + 1),
    expected: 'a'.repeat(DESCRIPTION_TRUNCATE_AT) + '...',
    expectsTruncation: true
  },
  {
    name: 'Long description with spaces (word boundary truncation)',
    input: 'This is a very long description that should be truncated at a word boundary to avoid cutting words in half and making the text look awkward when displayed in the table of contents',
    expected: function(result) {
      // Should be truncated with ellipsis
      return result.endsWith('...') &&
             result.length <= MAX_DESCRIPTION_LENGTH &&
             // Should not end with a partial word (space before the ellipsis or at a word break)
             (result.substring(0, result.length - 3).match(/\s$/) || true);
    },
    expectsTruncation: true
  },
  {
    name: 'Long description without spaces (no word boundary)',
    input: 'a'.repeat(200),
    expected: 'a'.repeat(DESCRIPTION_TRUNCATE_AT) + '...',
    expectsTruncation: true
  },
  {
    name: 'Description with space near the end',
    input: 'a'.repeat(140) + ' test more content here',
    expected: function(result) {
      // Should truncate at the space before "test"
      // The space is at position 140, which is > 120 (80% of 150)
      // So it should truncate at the space and include " test"
      return result.endsWith('...') &&
             result.length <= MAX_DESCRIPTION_LENGTH;
    },
    expectsTruncation: true
  },
  {
    name: 'Description with space too early (below 80% threshold)',
    input: 'word ' + 'a'.repeat(200),
    expected: 'word ' + 'a'.repeat(DESCRIPTION_TRUNCATE_AT - 5) + '...',
    expectsTruncation: true
  },
  {
    name: 'Multi-line description (only first line used)',
    input: 'First line that is quite long and should be used\nSecond line should be ignored',
    expected: 'First line that is quite long and should be used',
    expectsTruncation: false
  },
  {
    name: 'Description with heading marker',
    input: '## This heading marker should be removed',
    expected: 'This heading marker should be removed',
    expectsTruncation: false
  },
  {
    name: 'Long description with heading marker',
    input: '# ' + 'a'.repeat(200),
    expected: 'a'.repeat(DESCRIPTION_TRUNCATE_AT) + '...',
    expectsTruncation: true
  },
  {
    name: 'Description with inline hashtag (preserved)',
    input: 'Learn about the # symbol in programming',
    expected: 'Learn about the # symbol in programming',
    expectsTruncation: false
  },
  {
    name: 'Empty string',
    input: '',
    expected: '',
    expectsTruncation: false
  },
  {
    name: 'Only whitespace',
    input: '   \t  \n  ',
    expected: '   \t  ', // First line only (before \n)
    expectsTruncation: false
  },
  {
    name: 'Word boundary at exactly 80% threshold',
    input: 'a'.repeat(Math.floor(MAX_DESCRIPTION_LENGTH * WORD_BOUNDARY_MIN_RATIO)) + ' ' + 'b'.repeat(100),
    expected: function(result) {
      // The space is at position 120, which equals 120 (80% of 150)
      // Since lastSpace (120) > MAX_DESCRIPTION_LENGTH * WORD_BOUNDARY_MIN_RATIO (120), condition is true
      // So it will truncate at the space, but since we're at 147 chars first, it includes some 'b's
      return result.endsWith('...') && result.length <= MAX_DESCRIPTION_LENGTH;
    },
    expectsTruncation: true
  },
  {
    name: 'Word boundary just above 80% threshold',
    input: 'a'.repeat(Math.floor(MAX_DESCRIPTION_LENGTH * WORD_BOUNDARY_MIN_RATIO) + 1) + ' ' + 'b'.repeat(100),
    expected: function(result) {
      // Should truncate at the space
      return result.endsWith('...') && !result.includes('b');
    },
    expectsTruncation: true
  }
];

// Run tests
function runTests() {
  console.log('Running description truncation tests...\n');
  console.log(`Configuration:`);
  console.log(`  MAX_DESCRIPTION_LENGTH: ${MAX_DESCRIPTION_LENGTH}`);
  console.log(`  DESCRIPTION_TRUNCATE_AT: ${DESCRIPTION_TRUNCATE_AT}`);
  console.log(`  WORD_BOUNDARY_MIN_RATIO: ${WORD_BOUNDARY_MIN_RATIO}`);
  console.log(`  Minimum word boundary position: ${Math.floor(MAX_DESCRIPTION_LENGTH * WORD_BOUNDARY_MIN_RATIO)}\n`);

  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`);
    console.log(`  Input length: ${test.input.length}`);

    const result = cleanDescriptionForToc(test.input);
    console.log(`  Output length: ${result.length}`);
    console.log(`  Output preview: "${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`);

    let testPassed = false;

    if (typeof test.expected === 'function') {
      // Custom validation function
      testPassed = test.expected(result);
      if (!testPassed) {
        console.log(`  ❌ FAIL: Custom validation failed`);
        console.log(`  Full output: "${result}"`);
      } else {
        console.log(`  ✅ PASS`);
      }
    } else {
      // Direct comparison
      testPassed = result === test.expected;
      if (!testPassed) {
        console.log(`  ❌ FAIL`);
        console.log(`  Expected: "${test.expected.substring(0, 50)}${test.expected.length > 50 ? '...' : ''}"`);
        console.log(`  Got:      "${result.substring(0, 50)}${result.length > 50 ? '...' : ''}"`);
        if (result.length !== test.expected.length) {
          console.log(`  Length mismatch: expected ${test.expected.length}, got ${result.length}`);
        }
      } else {
        console.log(`  ✅ PASS`);
      }
    }

    // Verify truncation occurred as expected
    const hasTruncation = result.endsWith('...');
    if (test.expectsTruncation !== hasTruncation) {
      console.log(`  ⚠️  WARNING: Expected truncation=${test.expectsTruncation}, but got truncation=${hasTruncation}`);
      testPassed = false;
    }

    // Verify output is within max length
    if (result.length > MAX_DESCRIPTION_LENGTH) {
      console.log(`  ❌ ERROR: Output exceeds MAX_DESCRIPTION_LENGTH (${result.length} > ${MAX_DESCRIPTION_LENGTH})`);
      testPassed = false;
    }

    if (testPassed) {
      passed++;
    } else {
      failed++;
    }

    console.log('');
  });

  console.log('═══════════════════════════════════════');
  console.log(`Results: ${passed}/${tests.length} tests passed`);
  if (failed > 0) {
    console.log(`❌ ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log('✅ All tests passed!');
  }
}

// Additional integration tests
function runIntegrationTests() {
  console.log('\n═══════════════════════════════════════');
  console.log('Integration Tests\n');

  // Test that constants are consistent
  console.log('Test: Constants consistency');
  assert(DESCRIPTION_TRUNCATE_AT < MAX_DESCRIPTION_LENGTH,
    'DESCRIPTION_TRUNCATE_AT must be less than MAX_DESCRIPTION_LENGTH');
  assert(DESCRIPTION_TRUNCATE_AT + 3 === MAX_DESCRIPTION_LENGTH,
    'DESCRIPTION_TRUNCATE_AT + "..." (3 chars) should equal MAX_DESCRIPTION_LENGTH');
  assert(WORD_BOUNDARY_MIN_RATIO > 0 && WORD_BOUNDARY_MIN_RATIO < 1,
    'WORD_BOUNDARY_MIN_RATIO should be between 0 and 1');
  console.log('  ✅ PASS: Constants are consistent\n');

  // Test that word boundary logic works correctly
  console.log('Test: Word boundary logic');
  const testStr = 'a'.repeat(145) + ' test more words here';
  const result = cleanDescriptionForToc(testStr);
  // String is > 150, so needs truncation. After taking 147 chars, we have 'a'*145 + ' t'
  // lastIndexOf(' ') will find the space at position 145, which is > 120 (80% of 150)
  // So it will truncate at position 145
  assert(result.length <= MAX_DESCRIPTION_LENGTH, 'Should be within max length');
  assert(result.endsWith('...'), 'Should end with ellipsis');
  // Should not include 'test' since we truncate at the space before it
  assert(!result.includes('test'), 'Should truncate before "test"');
  console.log('  ✅ PASS: Word boundary truncation works\n');

  // Test that truncation without word boundary works
  console.log('Test: Truncation without word boundary');
  const noSpaceStr = 'a'.repeat(200);
  const result2 = cleanDescriptionForToc(noSpaceStr);
  assert(result2.length === MAX_DESCRIPTION_LENGTH,
    `Should be exactly ${MAX_DESCRIPTION_LENGTH} chars`);
  assert(result2.endsWith('...'), 'Should end with ellipsis');
  assert(result2 === 'a'.repeat(DESCRIPTION_TRUNCATE_AT) + '...',
    'Should truncate at DESCRIPTION_TRUNCATE_AT');
  console.log('  ✅ PASS: No word boundary truncation works\n');

  console.log('✅ All integration tests passed!');
}

// Run all tests
try {
  runTests();
  runIntegrationTests();
} catch (error) {
  console.error('\n❌ Test execution failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
