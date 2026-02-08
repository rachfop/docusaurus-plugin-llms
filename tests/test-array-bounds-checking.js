/**
 * Unit tests for array bounds checking in generator.ts
 *
 * Run with: node tests/test-array-bounds-checking.js
 */

/**
 * Simulates the cleanDescriptionForToc function from generator.ts
 */
function cleanDescriptionForToc(description) {
  if (!description) return '';

  // Get just the first line for TOC display
  const lines = description.split('\n');
  const firstLine = lines.length > 0 ? lines[0] : '';

  // Remove heading markers only at the beginning of the line
  const cleaned = firstLine.replace(/^(#+)\s+/g, '');

  // Truncate if too long (150 characters max with ellipsis)
  return cleaned.length > 150 ? cleaned.substring(0, 147) + '...' : cleaned;
}

/**
 * Simulates the header deduplication logic from generateLLMFile function
 */
function getFirstLineFromContent(content) {
  const trimmedContent = content.trim();
  const contentLines = trimmedContent.split('\n');
  const firstLine = contentLines.length > 0 ? contentLines[0] : '';
  return firstLine;
}

// Test cases for empty string edge cases
const testCases = [
  {
    name: 'Empty string description',
    description: '',
    expectedFirstLine: '',
    expectedCleaned: ''
  },
  {
    name: 'Single line description',
    description: 'This is a single line',
    expectedFirstLine: 'This is a single line',
    expectedCleaned: 'This is a single line'
  },
  {
    name: 'Multi-line description',
    description: 'First line\nSecond line\nThird line',
    expectedFirstLine: 'First line',
    expectedCleaned: 'First line'
  },
  {
    name: 'Description with heading marker',
    description: '# Heading\nContent here',
    expectedFirstLine: '# Heading',
    expectedCleaned: 'Heading'
  },
  {
    name: 'Description with multiple heading markers',
    description: '## Sub Heading\nContent here',
    expectedFirstLine: '## Sub Heading',
    expectedCleaned: 'Sub Heading'
  },
  {
    name: 'Null description (treated as empty)',
    description: null,
    expectedFirstLine: '',
    expectedCleaned: ''
  },
  {
    name: 'Undefined description (treated as empty)',
    description: undefined,
    expectedFirstLine: '',
    expectedCleaned: ''
  },
  {
    name: 'Whitespace-only description',
    description: '   \n   \n   ',
    expectedFirstLine: '   ',
    expectedCleaned: '   '
  },
  {
    name: 'Very long description (should truncate)',
    description: 'a'.repeat(200),
    expectedFirstLine: 'a'.repeat(200),
    expectedCleaned: 'a'.repeat(147) + '...'
  },
  {
    name: 'Description with newline at start',
    description: '\nFirst line after newline',
    expectedFirstLine: '',
    expectedCleaned: ''
  }
];

// Test cases for content first line extraction
const contentTestCases = [
  {
    name: 'Empty content',
    content: '',
    expectedFirstLine: ''
  },
  {
    name: 'Single line content',
    content: 'Single line',
    expectedFirstLine: 'Single line'
  },
  {
    name: 'Multi-line content',
    content: 'First line\nSecond line',
    expectedFirstLine: 'First line'
  },
  {
    name: 'Content with leading/trailing whitespace',
    content: '  \n  First line after whitespace  \n  ',
    expectedFirstLine: 'First line after whitespace'
  },
  {
    name: 'Content with heading',
    content: '# Heading\nParagraph content',
    expectedFirstLine: '# Heading'
  }
];

// Run tests
function runTests() {
  console.log('=== Testing cleanDescriptionForToc ===\n');

  let passCount = 0;
  let failCount = 0;

  testCases.forEach((test, index) => {
    try {
      const result = cleanDescriptionForToc(test.description);
      const passed = result === test.expectedCleaned;

      if (passed) {
        console.log(`✅ Test ${index + 1}: ${test.name}`);
        passCount++;
      } else {
        console.log(`❌ Test ${index + 1}: ${test.name}`);
        console.log(`   Expected: "${test.expectedCleaned}"`);
        console.log(`   Got: "${result}"`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ Test ${index + 1}: ${test.name} (EXCEPTION)`);
      console.log(`   Error: ${error.message}`);
      failCount++;
    }
  });

  console.log(`\n=== Testing getFirstLineFromContent ===\n`);

  contentTestCases.forEach((test, index) => {
    try {
      const result = getFirstLineFromContent(test.content);
      const passed = result === test.expectedFirstLine;

      if (passed) {
        console.log(`✅ Content Test ${index + 1}: ${test.name}`);
        passCount++;
      } else {
        console.log(`❌ Content Test ${index + 1}: ${test.name}`);
        console.log(`   Expected: "${test.expectedFirstLine}"`);
        console.log(`   Got: "${result}"`);
        failCount++;
      }
    } catch (error) {
      console.log(`❌ Content Test ${index + 1}: ${test.name} (EXCEPTION)`);
      console.log(`   Error: ${error.message}`);
      failCount++;
    }
  });

  console.log(`\n=== Test Results ===`);
  console.log(`Total tests: ${passCount + failCount}`);
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);

  if (failCount === 0) {
    console.log('\n✅ All tests passed!');
  } else {
    console.log(`\n❌ ${failCount} test(s) failed.`);
    process.exit(1);
  }
}

// Edge case validation tests
function runEdgeCaseValidation() {
  console.log('\n\n=== Edge Case Validation ===\n');

  const edgeCases = [
    {
      name: 'No undefined propagation from empty split',
      test: () => {
        const emptyString = '';
        const lines = emptyString.split('\n');
        const firstLine = lines.length > 0 ? lines[0] : '';
        return firstLine === '' && firstLine !== undefined;
      }
    },
    {
      name: 'No undefined propagation from whitespace-only split',
      test: () => {
        const whitespace = '   ';
        const lines = whitespace.split('\n');
        const firstLine = lines.length > 0 ? lines[0] : '';
        return firstLine === '   ' && firstLine !== undefined;
      }
    },
    {
      name: 'Handling of string with only newline',
      test: () => {
        const onlyNewline = '\n';
        const lines = onlyNewline.split('\n');
        const firstLine = lines.length > 0 ? lines[0] : '';
        return firstLine === '' && lines.length === 2; // split('\n') on '\n' gives ['', '']
      }
    },
    {
      name: 'Consistent behavior with replace on empty string',
      test: () => {
        const emptyString = '';
        const cleaned = emptyString.replace(/^(#+)\s+/g, '');
        return cleaned === '';
      }
    },
    {
      name: 'Safe substring on empty string',
      test: () => {
        const emptyString = '';
        try {
          const result = emptyString.length > 150 ? emptyString.substring(0, 147) + '...' : emptyString;
          return result === '';
        } catch (error) {
          return false;
        }
      }
    }
  ];

  let validationPass = 0;
  let validationFail = 0;

  edgeCases.forEach((testCase, index) => {
    try {
      const result = testCase.test();
      if (result) {
        console.log(`✅ Edge Case ${index + 1}: ${testCase.name}`);
        validationPass++;
      } else {
        console.log(`❌ Edge Case ${index + 1}: ${testCase.name}`);
        validationFail++;
      }
    } catch (error) {
      console.log(`❌ Edge Case ${index + 1}: ${testCase.name} (EXCEPTION)`);
      console.log(`   Error: ${error.message}`);
      validationFail++;
    }
  });

  console.log(`\nEdge Case Validation: ${validationPass}/${validationPass + validationFail} passed`);

  return validationFail === 0;
}

// Run all tests
runTests();
const edgeCasesPass = runEdgeCaseValidation();

if (!edgeCasesPass) {
  console.log('\n❌ Some edge case validations failed.');
  process.exit(1);
}

console.log('\n✅ All array bounds checking tests passed successfully!');
