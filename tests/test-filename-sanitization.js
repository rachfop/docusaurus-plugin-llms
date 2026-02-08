/**
 * Tests for filename sanitization functionality
 *
 * Run with: node test-filename-sanitization.js
 */

const { sanitizeForFilename } = require('../lib/utils');

const testCases = [
  // Current default behavior (ASCII-only, lowercase)
  {
    name: 'Converts to lowercase and removes unicode',
    input: 'Café Guide',
    expected: 'caf-guide',
    options: {}
  },
  {
    name: 'Removes unicode characters in default mode',
    input: 'Introdução à Programação',
    expected: 'introdu-o-programa-o',
    options: {}
  },
  {
    name: 'Removes emoji and unicode',
    input: 'Hello 世界 Guide',
    expected: 'hello-guide',
    options: {}
  },

  // Special characters handling
  {
    name: 'Removes special characters',
    input: 'C++ Programming: Advanced?',
    expected: 'c-programming-advanced',
    options: {}
  },
  {
    name: 'Handles multiple unsafe characters',
    input: 'File/Path\\Test:Name*Test',
    expected: 'file-path-test-name-test',
    options: {}
  },
  {
    name: 'Handles quotes and brackets',
    input: 'My "Guide" <2024>',
    expected: 'my-guide-2024',
    options: {}
  },
  {
    name: 'Handles pipes and question marks',
    input: 'What is this? | A Guide',
    expected: 'what-is-this-a-guide',
    options: {}
  },

  // Multiple dashes cleanup
  {
    name: 'Consolidates multiple dashes',
    input: 'Test---Multiple---Dashes',
    expected: 'test-multiple-dashes',
    options: {}
  },
  {
    name: 'Trims leading and trailing dashes',
    input: '---Leading and Trailing---',
    expected: 'leading-and-trailing',
    options: {}
  },

  // Edge cases
  {
    name: 'Handles empty string',
    input: '',
    expected: 'untitled',
    options: {}
  },
  {
    name: 'Handles only special characters',
    input: '***???',
    expected: 'untitled',
    options: {}
  },
  {
    name: 'Uses custom fallback',
    input: '',
    expected: 'my-fallback',
    options: {},
    fallback: 'my-fallback'
  },
  {
    name: 'Handles only spaces',
    input: '     ',
    expected: 'untitled',
    options: {}
  },
  {
    name: 'Handles single character',
    input: 'A',
    expected: 'a',
    options: {}
  },
  {
    name: 'Handles numbers only',
    input: '12345',
    expected: '12345',
    options: {}
  },

  // Real-world examples
  {
    name: 'Documentation title',
    input: 'Getting Started: Installation & Setup',
    expected: 'getting-started-installation-setup',
    options: {}
  },
  {
    name: 'API endpoint reference',
    input: 'POST /api/v1/users',
    expected: 'post-api-v1-users',
    options: {}
  },
  {
    name: 'Technical guide with symbols',
    input: 'Using $variables and @decorators',
    expected: 'using-variables-and-decorators',
    options: {}
  },
  {
    name: 'Version with dots',
    input: 'Version 3.2.1 Release Notes',
    expected: 'version-3-2-1-release-notes',
    options: {}
  },

  // Alphanumeric preservation
  {
    name: 'Preserves alphanumeric characters',
    input: 'test123guide',
    expected: 'test123guide',
    options: {}
  },
  {
    name: 'Mixed case becomes lowercase',
    input: 'MixedCaseTitle',
    expected: 'mixedcasetitle',
    options: {}
  },
  {
    name: 'Handles underscore',
    input: 'file_name_test',
    expected: 'file-name-test',
    options: {}
  },
  {
    name: 'Handles URL-like input',
    input: 'https://example.com/path',
    expected: 'https-example-com-path',
    options: {}
  }
];

function runTests() {
  console.log('Running filename sanitization tests...\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = sanitizeForFilename(
        testCase.input,
        testCase.fallback || 'untitled',
        testCase.options
      );

      if (result === testCase.expected) {
        console.log(`✅ PASS: ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${testCase.name}`);
        console.log(`   Input:    "${testCase.input}"`);
        console.log(`   Expected: "${testCase.expected}"`);
        console.log(`   Got:      "${result}"`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   ${error.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Filename Sanitization Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
const success = runTests();
console.log(success ? '🎉 All filename sanitization tests passed!' : '❌ Some tests failed.');
process.exit(success ? 0 : 1);
