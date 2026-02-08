/**
 * Integration test for plugin options validation
 *
 * Tests that the validation function is actually called during plugin initialization
 * and properly rejects invalid options.
 */

const assert = require('assert');
const path = require('path');

console.log('Testing plugin options validation integration...\n');

// Import the actual plugin
const docusaurusPluginLLMs = require('../lib/index.js').default;

// Mock context
const mockContext = {
  siteDir: '/tmp/test-site',
  siteConfig: {
    title: 'Test Site',
    tagline: 'Test tagline',
    url: 'https://example.com',
    baseUrl: '/'
  },
  outDir: '/tmp/test-site/build'
};

// Test cases
const testCases = [
  {
    name: 'Valid options should initialize plugin',
    options: {
      generateLLMsTxt: true,
      docsDir: 'docs'
    },
    shouldThrow: false,
    description: 'Plugin should initialize with valid options'
  },
  {
    name: 'Invalid includeOrder should throw',
    options: {
      includeOrder: 'not-an-array'
    },
    shouldThrow: true,
    expectedError: 'includeOrder must be an array',
    description: 'Plugin should reject invalid includeOrder'
  },
  {
    name: 'Invalid ignoreFiles should throw',
    options: {
      ignoreFiles: ['valid', 123]
    },
    shouldThrow: true,
    expectedError: 'ignoreFiles must contain only strings',
    description: 'Plugin should reject non-string elements in ignoreFiles'
  },
  {
    name: 'Invalid pathTransformation should throw',
    options: {
      pathTransformation: 'not-an-object'
    },
    shouldThrow: true,
    expectedError: 'pathTransformation must be an object',
    description: 'Plugin should reject invalid pathTransformation'
  },
  {
    name: 'Invalid boolean option should throw',
    options: {
      generateLLMsTxt: 'true'
    },
    shouldThrow: true,
    expectedError: 'generateLLMsTxt must be a boolean',
    description: 'Plugin should reject non-boolean for boolean options'
  },
  {
    name: 'Invalid customLLMFiles should throw',
    options: {
      customLLMFiles: [{
        filename: 'test.txt',
        includePatterns: [],
        fullContent: true
      }]
    },
    shouldThrow: true,
    expectedError: 'customLLMFiles[0].includePatterns must be a non-empty array',
    description: 'Plugin should reject empty includePatterns'
  },
  {
    name: 'Invalid logLevel should throw',
    options: {
      logLevel: 'debug'
    },
    shouldThrow: true,
    expectedError: 'logLevel must be one of: quiet, normal, verbose',
    description: 'Plugin should reject invalid logLevel values'
  }
];

// Run tests
let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  try {
    if (testCase.shouldThrow) {
      // Test should throw an error
      try {
        docusaurusPluginLLMs(mockContext, testCase.options);
        console.log(`  ${index + 1}. FAIL: ${testCase.name}`);
        console.log(`     Expected error but plugin initialized successfully`);
        console.log(`     Description: ${testCase.description}\n`);
        failedTests++;
      } catch (err) {
        if (err.message === testCase.expectedError) {
          console.log(`  ${index + 1}. PASS: ${testCase.name}`);
          passedTests++;
        } else {
          console.log(`  ${index + 1}. FAIL: ${testCase.name}`);
          console.log(`     Expected error: ${testCase.expectedError}`);
          console.log(`     Got error: ${err.message}`);
          console.log(`     Description: ${testCase.description}\n`);
          failedTests++;
        }
      }
    } else {
      // Test should not throw an error
      const plugin = docusaurusPluginLLMs(mockContext, testCase.options);
      if (plugin && plugin.name === 'docusaurus-plugin-llms') {
        console.log(`  ${index + 1}. PASS: ${testCase.name}`);
        passedTests++;
      } else {
        console.log(`  ${index + 1}. FAIL: ${testCase.name}`);
        console.log(`     Plugin did not return expected object`);
        console.log(`     Description: ${testCase.description}\n`);
        failedTests++;
      }
    }
  } catch (err) {
    console.log(`  ${index + 1}. FAIL: ${testCase.name}`);
    console.log(`     Unexpected error: ${err.message}`);
    console.log(`     Description: ${testCase.description}\n`);
    failedTests++;
  }
});

console.log('\n' + '='.repeat(50));
console.log(`Test Results: ${passedTests}/${testCases.length} passed, ${failedTests} failed`);
console.log('='.repeat(50));

if (failedTests > 0) {
  process.exit(1);
}
