/**
 * Tests for improved filename sanitization functionality
 *
 * Run with: node test-filename-sanitization-improved.js
 */

const { sanitizeForFilename } = require('../lib/utils');

const testCases = [
  // Default behavior (preserveUnicode: true, preserveCase: false)
  {
    name: 'Preserves unicode characters by default',
    input: 'Café Guide',
    expected: 'café-guide',
    options: {}
  },
  {
    name: 'Preserves unicode in default mode',
    input: 'Introdução à Programação',
    expected: 'introdução-à-programação',
    options: {}
  },
  {
    name: 'Preserves emoji and unicode',
    input: 'Hello 世界 Guide',
    expected: 'hello-世界-guide',
    options: {}
  },

  // ASCII-only mode (preserveUnicode: false)
  {
    name: 'Removes unicode in ASCII-only mode',
    input: 'Café Guide',
    expected: 'caf-guide',
    options: { preserveUnicode: false }
  },
  {
    name: 'Removes unicode characters in ASCII-only mode',
    input: 'Introdução à Programação',
    expected: 'introdu-o-programa-o',
    options: { preserveUnicode: false }
  },
  {
    name: 'Removes emoji and unicode in ASCII-only mode',
    input: 'Hello 世界 Guide',
    expected: 'hello-guide',
    options: { preserveUnicode: false }
  },

  // Special characters handling (filesystem-unsafe)
  {
    name: 'Removes unsafe special characters',
    input: 'C++ Programming: Advanced?',
    expected: 'c++-programming-advanced',
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

  // Valid special characters preservation
  {
    name: 'Preserves underscores',
    input: 'file_name_test',
    expected: 'file_name_test',
    options: {}
  },
  {
    name: 'Preserves underscores in ASCII-only mode',
    input: 'file_name_test',
    expected: 'file_name_test',
    options: { preserveUnicode: false }
  },
  {
    name: 'Preserves dots in middle',
    input: 'version.3.2.1',
    expected: 'version.3.2.1',
    options: {}
  },
  {
    name: 'Removes leading dots',
    input: '...hidden_file',
    expected: 'hidden_file',
    options: {}
  },
  {
    name: 'Preserves hyphens',
    input: 'my-great-file',
    expected: 'my-great-file',
    options: {}
  },
  {
    name: 'Preserves mixed valid characters',
    input: 'my_file-v3.2.1',
    expected: 'my_file-v3.2.1',
    options: {}
  },

  // Spaces are replaced with dashes
  {
    name: 'Replaces spaces with dashes',
    input: 'hello world test',
    expected: 'hello-world-test',
    options: {}
  },
  {
    name: 'Replaces multiple spaces with single dash',
    input: 'hello    world',
    expected: 'hello-world',
    options: {}
  },
  {
    name: 'Handles tabs as whitespace',
    input: 'hello\tworld',
    expected: 'hello-world',
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
    expected: 'getting-started-installation-&-setup',
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
    expected: 'using-$variables-and-@decorators',
    options: {}
  },
  {
    name: 'Version with dots',
    input: 'Version 3.2.1 Release Notes',
    expected: 'version-3.2.1-release-notes',
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
    name: 'Handles URL-like input',
    input: 'https://example.com/path',
    expected: 'https-example.com-path',
    options: {}
  },

  // Case preservation mode
  {
    name: 'Preserves case when requested',
    input: 'MixedCaseTitle',
    expected: 'MixedCaseTitle',
    options: { preserveCase: true }
  },
  {
    name: 'Preserves case with underscores',
    input: 'My_File_Name',
    expected: 'My_File_Name',
    options: { preserveCase: true }
  },

  // Combined options
  {
    name: 'ASCII-only + preserve case',
    input: 'My Café File',
    expected: 'My-Caf-File',
    options: { preserveUnicode: false, preserveCase: true }
  },

  // Backward compatibility - ASCII-only mode matches old behavior
  {
    name: 'ASCII mode matches old behavior for unicode',
    input: 'Café Guide',
    expected: 'caf-guide',
    options: { preserveUnicode: false }
  },
  {
    name: 'ASCII mode preserves underscores',
    input: 'file_name_test',
    expected: 'file_name_test',
    options: { preserveUnicode: false }
  }
];

function runTests() {
  console.log('Running improved filename sanitization tests...\n');

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
        console.log(`   Options:  ${Object.keys(testCase.options).length > 0 ? JSON.stringify(testCase.options) : 'default'}`);
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
  console.log(`Improved Filename Sanitization Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
const success = runTests();
console.log(success ? '🎉 All improved filename sanitization tests passed!' : '❌ Some tests failed.');
process.exit(success ? 0 : 1);
