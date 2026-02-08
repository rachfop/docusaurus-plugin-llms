/**
 * Tests for filename sanitization functionality
 *
 * Run with: node test-filename-sanitization.js
 */

const { sanitizeForFilename } = require('../lib/utils');

const testCases = [
  // ASCII-only mode (preserveUnicode: false)
  {
    name: 'Converts to lowercase and removes unicode (ASCII mode)',
    input: 'Café Guide',
    expected: 'caf-guide',
    options: { preserveUnicode: false }
  },
  {
    name: 'Removes unicode characters in ASCII mode',
    input: 'Introdução à Programação',
    expected: 'introdu-o-programa-o',
    options: { preserveUnicode: false }
  },
  {
    name: 'Removes emoji and unicode (ASCII mode)',
    input: 'Hello 世界 Guide',
    expected: 'hello-guide',
    options: { preserveUnicode: false }
  },

  // Special characters handling (Unicode mode is default)
  {
    name: 'Removes special characters (Unicode mode)',
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

  // Real-world examples (Unicode mode preserves more characters)
  {
    name: 'Documentation title (Unicode mode)',
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
    name: 'Technical guide with symbols (Unicode mode)',
    input: 'Using $variables and @decorators',
    expected: 'using-$variables-and-@decorators',
    options: {}
  },
  {
    name: 'Version with dots (Unicode mode preserves dots)',
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
    name: 'Preserves underscores (Unicode mode)',
    input: 'file_name_test',
    expected: 'file_name_test',
    options: {}
  },
  {
    name: 'Handles URL-like input (Unicode mode preserves dots)',
    input: 'https://example.com/path',
    expected: 'https-example.com-path',
    options: {}
  },

  // Unicode preservation tests (preserveUnicode: true)
  {
    name: 'Preserves unicode characters with preserveUnicode',
    input: 'Café Guide',
    expected: 'café-guide',
    options: { preserveUnicode: true }
  },
  {
    name: 'Preserves unicode accents',
    input: 'Introdução à Programação',
    expected: 'introdução-à-programação',
    options: { preserveUnicode: true }
  },
  {
    name: 'Preserves Chinese characters',
    input: 'Hello 世界 Guide',
    expected: 'hello-世界-guide',
    options: { preserveUnicode: true }
  },
  {
    name: 'Preserves emoji with unicode',
    input: 'Guide 🚀 Rocket',
    expected: 'guide-🚀-rocket',
    options: { preserveUnicode: true }
  },
  {
    name: 'Removes only unsafe characters with unicode',
    input: 'Café/Guide\\Test:Name*File',
    expected: 'café-guide-test-name-file',
    options: { preserveUnicode: true }
  },

  // Case preservation tests
  {
    name: 'Preserves case when requested',
    input: 'MixedCaseTitle',
    expected: 'MixedCaseTitle',
    options: { preserveCase: true }
  },
  {
    name: 'Preserves case with unicode',
    input: 'Café Guide',
    expected: 'Café-Guide',
    options: { preserveUnicode: true, preserveCase: true }
  },

  // Valid special character tests
  {
    name: 'Preserves underscores with unicode',
    input: 'file_name_test',
    expected: 'file_name_test',
    options: { preserveUnicode: true }
  },
  {
    name: 'Preserves hyphens',
    input: 'my-test-file',
    expected: 'my-test-file',
    options: { preserveUnicode: true }
  },
  {
    name: 'Preserves dots in middle of name',
    input: 'version.3.2.1',
    expected: 'version.3.2.1',
    options: { preserveUnicode: true }
  },
  {
    name: 'Removes leading dots with unicode',
    input: '...hidden-file',
    expected: 'hidden-file',
    options: { preserveUnicode: true }
  },
  {
    name: 'Preserves alphanumeric and valid chars',
    input: 'test_123-guide.v2',
    expected: 'test_123-guide.v2',
    options: { preserveUnicode: true }
  },

  // Complex real-world cases with unicode
  {
    name: 'Technical doc with unicode and symbols',
    input: 'Configuração: Sistema & Instalação',
    expected: 'configuração-sistema-&-instalação',
    options: { preserveUnicode: true }
  },
  {
    name: 'Mixed unicode and ASCII with unsafe chars',
    input: 'Guide: Hello/世界\\Test',
    expected: 'guide-hello-世界-test',
    options: { preserveUnicode: true }
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
