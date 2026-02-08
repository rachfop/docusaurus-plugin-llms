/**
 * Tests for input validation utilities
 *
 * Run with: node test-input-validation.js
 */

const {
  ValidationError,
  validateRequired,
  validateString,
  validateArray,
  sanitizeForFilename,
  ensureUniqueIdentifier,
  normalizePath
} = require('../lib/utils');

function testValidationError() {
  console.log('\n=== Testing ValidationError ===\n');

  try {
    throw new ValidationError('Test error message');
  } catch (error) {
    if (error instanceof ValidationError &&
        error.name === 'ValidationError' &&
        error.message === 'Test error message') {
      console.log('✅ PASS: ValidationError class works correctly');
    } else {
      console.log('❌ FAIL: ValidationError class');
      return false;
    }
  }

  return true;
}

function testValidateRequired() {
  console.log('\n=== Testing validateRequired ===\n');

  let passed = 0;
  let failed = 0;

  // Test valid values
  try {
    const result = validateRequired('test', 'testParam');
    if (result === 'test') {
      console.log('✅ PASS: validateRequired accepts valid string');
      passed++;
    } else {
      console.log('❌ FAIL: validateRequired should return the value');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: validateRequired should not throw for valid value');
    failed++;
  }

  // Test null value
  try {
    validateRequired(null, 'testParam');
    console.log('❌ FAIL: validateRequired should throw for null');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError &&
        error.message.includes('null or undefined')) {
      console.log('✅ PASS: validateRequired throws for null');
      passed++;
    } else {
      console.log('❌ FAIL: validateRequired throws wrong error for null');
      failed++;
    }
  }

  // Test undefined value
  try {
    validateRequired(undefined, 'testParam');
    console.log('❌ FAIL: validateRequired should throw for undefined');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError &&
        error.message.includes('null or undefined')) {
      console.log('✅ PASS: validateRequired throws for undefined');
      passed++;
    } else {
      console.log('❌ FAIL: validateRequired throws wrong error for undefined');
      failed++;
    }
  }

  // Test with number (valid)
  try {
    const result = validateRequired(42, 'numberParam');
    if (result === 42) {
      console.log('✅ PASS: validateRequired accepts numbers');
      passed++;
    } else {
      console.log('❌ FAIL: validateRequired should return number value');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: validateRequired should not throw for number');
    failed++;
  }

  // Test with false (valid - should not be considered falsy)
  try {
    const result = validateRequired(false, 'boolParam');
    if (result === false) {
      console.log('✅ PASS: validateRequired accepts false');
      passed++;
    } else {
      console.log('❌ FAIL: validateRequired should return false');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: validateRequired should not throw for false');
    failed++;
  }

  return failed === 0;
}

function testValidateString() {
  console.log('\n=== Testing validateString ===\n');

  let passed = 0;
  let failed = 0;

  // Test valid string
  try {
    const result = validateString('hello', 'testParam');
    if (result === 'hello') {
      console.log('✅ PASS: validateString accepts valid string');
      passed++;
    } else {
      console.log('❌ FAIL: validateString should return the string');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: validateString should not throw for valid string');
    failed++;
  }

  // Test non-string value
  try {
    validateString(123, 'testParam');
    console.log('❌ FAIL: validateString should throw for non-string');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError &&
        error.message.includes('must be a string')) {
      console.log('✅ PASS: validateString throws for non-string');
      passed++;
    } else {
      console.log('❌ FAIL: validateString throws wrong error for non-string');
      failed++;
    }
  }

  // Test minLength validation
  try {
    validateString('ab', 'testParam', { minLength: 3 });
    console.log('❌ FAIL: validateString should throw for string too short');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError &&
        error.message.includes('at least')) {
      console.log('✅ PASS: validateString validates minLength');
      passed++;
    } else {
      console.log('❌ FAIL: validateString throws wrong error for minLength');
      failed++;
    }
  }

  // Test maxLength validation
  try {
    validateString('abcdef', 'testParam', { maxLength: 3 });
    console.log('❌ FAIL: validateString should throw for string too long');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError &&
        error.message.includes('exceeds maximum length')) {
      console.log('✅ PASS: validateString validates maxLength');
      passed++;
    } else {
      console.log('❌ FAIL: validateString throws wrong error for maxLength');
      failed++;
    }
  }

  // Test pattern validation
  try {
    validateString('abc123', 'testParam', { pattern: /^[a-z]+$/ });
    console.log('❌ FAIL: validateString should throw for pattern mismatch');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError &&
        error.message.includes('does not match')) {
      console.log('✅ PASS: validateString validates pattern');
      passed++;
    } else {
      console.log('❌ FAIL: validateString throws wrong error for pattern');
      failed++;
    }
  }

  // Test pattern matching success
  try {
    const result = validateString('abc', 'testParam', { pattern: /^[a-z]+$/ });
    if (result === 'abc') {
      console.log('✅ PASS: validateString accepts matching pattern');
      passed++;
    } else {
      console.log('❌ FAIL: validateString should return value for matching pattern');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: validateString should not throw for matching pattern');
    failed++;
  }

  return failed === 0;
}

function testValidateArray() {
  console.log('\n=== Testing validateArray ===\n');

  let passed = 0;
  let failed = 0;

  // Test valid array
  try {
    const result = validateArray([1, 2, 3], 'testParam');
    if (Array.isArray(result) && result.length === 3) {
      console.log('✅ PASS: validateArray accepts valid array');
      passed++;
    } else {
      console.log('❌ FAIL: validateArray should return the array');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: validateArray should not throw for valid array');
    failed++;
  }

  // Test non-array value
  try {
    validateArray('not an array', 'testParam');
    console.log('❌ FAIL: validateArray should throw for non-array');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError &&
        error.message.includes('must be an array')) {
      console.log('✅ PASS: validateArray throws for non-array');
      passed++;
    } else {
      console.log('❌ FAIL: validateArray throws wrong error for non-array');
      failed++;
    }
  }

  // Test element validator - all valid
  try {
    const result = validateArray([1, 2, 3], 'testParam', (item) => typeof item === 'number');
    if (Array.isArray(result) && result.length === 3) {
      console.log('✅ PASS: validateArray accepts array with valid elements');
      passed++;
    } else {
      console.log('❌ FAIL: validateArray should return array with valid elements');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: validateArray should not throw for array with valid elements');
    failed++;
  }

  // Test element validator - invalid element
  try {
    validateArray([1, 'two', 3], 'testParam', (item) => typeof item === 'number');
    console.log('❌ FAIL: validateArray should throw for invalid element');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError &&
        error.message.includes('failed validation')) {
      console.log('✅ PASS: validateArray validates elements');
      passed++;
    } else {
      console.log('❌ FAIL: validateArray throws wrong error for invalid element');
      failed++;
    }
  }

  // Test empty array
  try {
    const result = validateArray([], 'testParam');
    if (Array.isArray(result) && result.length === 0) {
      console.log('✅ PASS: validateArray accepts empty array');
      passed++;
    } else {
      console.log('❌ FAIL: validateArray should accept empty array');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: validateArray should not throw for empty array');
    failed++;
  }

  return failed === 0;
}

function testSanitizeForFilenameValidation() {
  console.log('\n=== Testing sanitizeForFilename Validation ===\n');

  let passed = 0;
  let failed = 0;

  // Test with valid inputs
  try {
    const result = sanitizeForFilename('Test File', 'default');
    if (result) {
      console.log('✅ PASS: sanitizeForFilename works with valid inputs');
      passed++;
    } else {
      console.log('❌ FAIL: sanitizeForFilename should return a value');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: sanitizeForFilename should not throw for valid inputs');
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test with non-string input
  try {
    sanitizeForFilename(123, 'default');
    console.log('❌ FAIL: sanitizeForFilename should validate input type');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: sanitizeForFilename validates input type');
      passed++;
    } else {
      console.log('❌ FAIL: sanitizeForFilename throws wrong error type');
      failed++;
    }
  }

  // Test with non-string fallback
  try {
    sanitizeForFilename('test', 123);
    console.log('❌ FAIL: sanitizeForFilename should validate fallback type');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: sanitizeForFilename validates fallback type');
      passed++;
    } else {
      console.log('❌ FAIL: sanitizeForFilename throws wrong error type for fallback');
      failed++;
    }
  }

  // Test with empty fallback
  try {
    sanitizeForFilename('test', '');
    console.log('❌ FAIL: sanitizeForFilename should reject empty fallback');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: sanitizeForFilename rejects empty fallback');
      passed++;
    } else {
      console.log('❌ FAIL: sanitizeForFilename throws wrong error for empty fallback');
      failed++;
    }
  }

  return failed === 0;
}

function testEnsureUniqueIdentifierValidation() {
  console.log('\n=== Testing ensureUniqueIdentifier Validation ===\n');

  let passed = 0;
  let failed = 0;

  // Test with valid inputs
  try {
    const usedIds = new Set();
    const result = ensureUniqueIdentifier('test', usedIds);
    if (result === 'test') {
      console.log('✅ PASS: ensureUniqueIdentifier works with valid inputs');
      passed++;
    } else {
      console.log('❌ FAIL: ensureUniqueIdentifier should return identifier');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: ensureUniqueIdentifier should not throw for valid inputs');
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test with non-string identifier
  try {
    const usedIds = new Set();
    ensureUniqueIdentifier(123, usedIds);
    console.log('❌ FAIL: ensureUniqueIdentifier should validate identifier type');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: ensureUniqueIdentifier validates identifier type');
      passed++;
    } else {
      console.log('❌ FAIL: ensureUniqueIdentifier throws wrong error type');
      failed++;
    }
  }

  // Test with empty identifier
  try {
    const usedIds = new Set();
    ensureUniqueIdentifier('', usedIds);
    console.log('❌ FAIL: ensureUniqueIdentifier should reject empty identifier');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: ensureUniqueIdentifier rejects empty identifier');
      passed++;
    } else {
      console.log('❌ FAIL: ensureUniqueIdentifier throws wrong error for empty identifier');
      failed++;
    }
  }

  // Test with non-Set usedIdentifiers
  try {
    ensureUniqueIdentifier('test', ['not', 'a', 'set']);
    console.log('❌ FAIL: ensureUniqueIdentifier should validate usedIdentifiers type');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: ensureUniqueIdentifier validates usedIdentifiers type');
      passed++;
    } else {
      console.log('❌ FAIL: ensureUniqueIdentifier throws wrong error type for usedIdentifiers');
      failed++;
    }
  }

  // Test with null usedIdentifiers
  try {
    ensureUniqueIdentifier('test', null);
    console.log('❌ FAIL: ensureUniqueIdentifier should reject null usedIdentifiers');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: ensureUniqueIdentifier rejects null usedIdentifiers');
      passed++;
    } else {
      console.log('❌ FAIL: ensureUniqueIdentifier throws wrong error for null usedIdentifiers');
      failed++;
    }
  }

  return failed === 0;
}

function testNormalizePathValidation() {
  console.log('\n=== Testing normalizePath Validation ===\n');

  let passed = 0;
  let failed = 0;

  // Test with valid input
  try {
    const result = normalizePath('path\\to\\file');
    if (result === 'path/to/file') {
      console.log('✅ PASS: normalizePath works with valid input');
      passed++;
    } else {
      console.log('❌ FAIL: normalizePath should normalize path');
      failed++;
    }
  } catch (error) {
    console.log('❌ FAIL: normalizePath should not throw for valid input');
    console.log(`   Error: ${error.message}`);
    failed++;
  }

  // Test with non-string input
  try {
    normalizePath(123);
    console.log('❌ FAIL: normalizePath should validate input type');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: normalizePath validates input type');
      passed++;
    } else {
      console.log('❌ FAIL: normalizePath throws wrong error type');
      failed++;
    }
  }

  // Test with null input
  try {
    normalizePath(null);
    console.log('❌ FAIL: normalizePath should reject null input');
    failed++;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.log('✅ PASS: normalizePath rejects null input');
      passed++;
    } else {
      console.log('❌ FAIL: normalizePath throws wrong error for null input');
      failed++;
    }
  }

  return failed === 0;
}

// Run all tests
function runAllTests() {
  console.log('========================================');
  console.log('Running Input Validation Tests');
  console.log('========================================');

  const results = {
    validationError: testValidationError(),
    validateRequired: testValidateRequired(),
    validateString: testValidateString(),
    validateArray: testValidateArray(),
    sanitizeForFilename: testSanitizeForFilenameValidation(),
    ensureUniqueIdentifier: testEnsureUniqueIdentifierValidation(),
    normalizePath: testNormalizePathValidation()
  };

  const passed = Object.values(results).filter(r => r === true).length;
  const failed = Object.values(results).filter(r => r === false).length;

  console.log('\n========================================');
  console.log('Input Validation Tests Summary:');
  console.log(`Passed: ${passed}/${Object.keys(results).length}`);
  console.log(`Failed: ${failed}/${Object.keys(results).length}`);
  console.log('========================================\n');

  return failed === 0;
}

// Execute tests
const success = runAllTests();
console.log(success ? '🎉 All input validation tests passed!' : '❌ Some tests failed.');
process.exit(success ? 0 : 1);
