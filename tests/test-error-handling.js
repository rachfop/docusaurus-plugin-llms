/**
 * Tests for error handling utilities
 *
 * Run with: node test-error-handling.js
 */

const { getErrorMessage, getErrorStack } = require('../lib/utils');

const testCases = [
  {
    name: 'getErrorMessage handles Error instances',
    test() {
      const error = new Error('Test error message');
      const result = getErrorMessage(error);

      if (result === 'Test error message') {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected "Test error message", got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorMessage handles string errors',
    test() {
      const error = 'String error message';
      const result = getErrorMessage(error);

      if (result === 'String error message') {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected "String error message", got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorMessage handles object errors',
    test() {
      const error = { code: 'ERR_TEST', message: 'Object error' };
      const result = getErrorMessage(error);

      // Should JSON.stringify the object
      const expected = JSON.stringify(error);
      if (result === expected) {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected "${expected}", got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorMessage handles null',
    test() {
      const error = null;
      const result = getErrorMessage(error);

      // Should return 'Unknown error' when JSON.stringify returns 'null'
      // or the stringified value
      if (result === 'null' || result === 'Unknown error') {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected 'null' or 'Unknown error', got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorMessage handles undefined',
    test() {
      const error = undefined;
      const result = getErrorMessage(error);

      // Should return 'Unknown error' when JSON.stringify returns undefined
      // or handle it gracefully
      if (typeof result === 'string' && result.length > 0) {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected a non-empty string, got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorMessage handles circular references',
    test() {
      const error = { code: 'ERR_CIRCULAR' };
      error.self = error; // Create circular reference

      const result = getErrorMessage(error);

      // Should return 'Unknown error' when JSON.stringify fails
      if (result === 'Unknown error') {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected "Unknown error", got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorMessage handles numbers',
    test() {
      const error = 42;
      const result = getErrorMessage(error);

      // Should JSON.stringify the number
      if (result === '42') {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected "42", got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorMessage handles arrays',
    test() {
      const error = ['error', 'array'];
      const result = getErrorMessage(error);

      // Should JSON.stringify the array
      const expected = JSON.stringify(error);
      if (result === expected) {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected "${expected}", got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorStack returns stack from Error instances',
    test() {
      const error = new Error('Test error');
      const result = getErrorStack(error);

      if (typeof result === 'string' && result.includes('Error: Test error')) {
        return { passed: true };
      } else {
        return { passed: false, error: `Expected stack trace, got "${result}"` };
      }
    }
  },
  {
    name: 'getErrorStack returns undefined for non-Error types',
    test() {
      const testValues = [
        'string error',
        42,
        { message: 'object' },
        null,
        undefined,
        ['array']
      ];

      for (const error of testValues) {
        const result = getErrorStack(error);
        if (result !== undefined) {
          return {
            passed: false,
            error: `Expected undefined for ${typeof error}, got "${result}"`
          };
        }
      }

      return { passed: true };
    }
  },
  {
    name: 'Type safety - catch blocks can use unknown',
    test() {
      // This test verifies that the pattern works in practice
      try {
        throw new Error('Test error');
      } catch (err) {
        // In TypeScript, this would be typed as unknown
        const message = getErrorMessage(err);
        const stack = getErrorStack(err);

        if (message === 'Test error' && typeof stack === 'string') {
          return { passed: true };
        } else {
          return {
            passed: false,
            error: `Unexpected results: message="${message}", stack="${typeof stack}"`
          };
        }
      }

      return { passed: false, error: 'Did not catch expected error' };
    }
  },
  {
    name: 'Type safety - string errors work correctly',
    test() {
      try {
        throw 'String error';
      } catch (err) {
        const message = getErrorMessage(err);
        const stack = getErrorStack(err);

        if (message === 'String error' && stack === undefined) {
          return { passed: true };
        } else {
          return {
            passed: false,
            error: `Unexpected results: message="${message}", stack="${stack}"`
          };
        }
      }

      return { passed: false, error: 'Did not catch expected error' };
    }
  },
  {
    name: 'Error messages preserve details',
    test() {
      const error = new Error('Detailed error: File not found at /path/to/file.txt');
      const result = getErrorMessage(error);

      if (result === 'Detailed error: File not found at /path/to/file.txt') {
        return { passed: true };
      } else {
        return {
          passed: false,
          error: `Error message not preserved: "${result}"`
        };
      }
    }
  }
];

async function runTests() {
  console.log('Running error handling utilities tests...\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const result = testCase.test();

      if (result.passed) {
        console.log(`✅ PASS: ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${testCase.name}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Error Handling Utilities Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${testCases.length}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runTests()
  .then(success => {
    if (success) {
      console.log('🎉 All error handling utilities tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
