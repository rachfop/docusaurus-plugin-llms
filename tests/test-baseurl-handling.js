/**
 * Test suite for baseUrl handling in URL construction
 *
 * Tests various baseUrl configurations to ensure proper URL concatenation:
 * - Root baseUrl '/'
 * - baseUrl with trailing slash
 * - baseUrl without trailing slash
 * - Empty/undefined baseUrl
 */

const assert = require('assert');
const path = require('path');

console.log('Testing baseUrl handling in URL construction...\n');

// Simulate the baseUrl normalization logic from the plugin
function normalizeBaseUrl(baseUrl) {
  let normalizedBaseUrl = baseUrl || '/';
  if (normalizedBaseUrl !== '/' && normalizedBaseUrl.endsWith('/')) {
    normalizedBaseUrl = normalizedBaseUrl.slice(0, -1);
  }
  return normalizedBaseUrl;
}

function constructSiteUrl(url, baseUrl) {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  return url + normalizedBaseUrl;
}

// Test cases
const testCases = [
  {
    name: 'Root baseUrl',
    url: 'https://example.com',
    baseUrl: '/',
    expected: 'https://example.com/',
    description: 'Root baseUrl should be kept as-is'
  },
  {
    name: 'baseUrl with trailing slash',
    url: 'https://example.com',
    baseUrl: '/docs/',
    expected: 'https://example.com/docs',
    description: 'Trailing slash should be removed except for root'
  },
  {
    name: 'baseUrl without trailing slash',
    url: 'https://example.com',
    baseUrl: '/docs',
    expected: 'https://example.com/docs',
    description: 'baseUrl without trailing slash should remain unchanged'
  },
  {
    name: 'Empty baseUrl',
    url: 'https://example.com',
    baseUrl: '',
    expected: 'https://example.com/',
    description: 'Empty baseUrl should default to root'
  },
  {
    name: 'Undefined baseUrl',
    url: 'https://example.com',
    baseUrl: undefined,
    expected: 'https://example.com/',
    description: 'Undefined baseUrl should default to root'
  },
  {
    name: 'Deep path with trailing slash',
    url: 'https://example.com',
    baseUrl: '/docs/api/v1/',
    expected: 'https://example.com/docs/api/v1',
    description: 'Deep path with trailing slash should have it removed'
  },
  {
    name: 'Deep path without trailing slash',
    url: 'https://example.com',
    baseUrl: '/docs/api/v1',
    expected: 'https://example.com/docs/api/v1',
    description: 'Deep path without trailing slash should remain unchanged'
  },
  {
    name: 'URL with port and root baseUrl',
    url: 'https://example.com:8080',
    baseUrl: '/',
    expected: 'https://example.com:8080/',
    description: 'URL with port should handle root baseUrl correctly'
  },
  {
    name: 'URL with port and path baseUrl',
    url: 'https://example.com:8080',
    baseUrl: '/docs/',
    expected: 'https://example.com:8080/docs',
    description: 'URL with port should handle path baseUrl correctly'
  },
  {
    name: 'URL with trailing slash and root baseUrl',
    url: 'https://example.com/',
    baseUrl: '/',
    expected: 'https://example.com//',
    description: 'URL with trailing slash concatenates directly'
  },
  {
    name: 'URL with trailing slash and path baseUrl',
    url: 'https://example.com/',
    baseUrl: '/docs/',
    expected: 'https://example.com//docs',
    description: 'URL with trailing slash concatenates with normalized baseUrl'
  }
];

// Run tests
let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  try {
    const result = constructSiteUrl(testCase.url, testCase.baseUrl);

    assert.strictEqual(
      result,
      testCase.expected,
      `Expected "${testCase.expected}" but got "${result}"`
    );

    console.log(`✓ Test ${index + 1} passed: ${testCase.name}`);
    console.log(`  Input: url="${testCase.url}", baseUrl="${testCase.baseUrl}"`);
    console.log(`  Output: "${result}"`);
    console.log(`  ${testCase.description}\n`);
    passedTests++;
  } catch (error) {
    console.error(`✗ Test ${index + 1} failed: ${testCase.name}`);
    console.error(`  Input: url="${testCase.url}", baseUrl="${testCase.baseUrl}"`);
    console.error(`  ${error.message}\n`);
    failedTests++;
  }
});

// Summary
console.log('='.repeat(60));
console.log(`Test Summary:`);
console.log(`  Total tests: ${testCases.length}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);
console.log('='.repeat(60));

if (failedTests > 0) {
  process.exit(1);
}

console.log('\n✓ All baseUrl handling tests passed!');
