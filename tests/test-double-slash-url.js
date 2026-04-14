/**
 * Test suite for double-slash URL prevention when baseUrl is root ('/')
 *
 * Regression test for issue #27:
 * When generateMarkdownFiles is true and baseUrl is '/', generated URLs
 * should not contain double slashes (e.g., https://example.com//docs/intro.md).
 *
 * Root cause: siteUrl already ends with '/' when baseUrl is '/', so naively
 * concatenating `${siteUrl}/${urlPath}` produces a double slash.
 *
 * Fix: Strip trailing slash from siteUrl before concatenating.
 */

const assert = require('assert');

console.log('Testing double-slash URL prevention in markdown file URL generation...\n');

// Simulate the URL construction logic from generator.ts (generateMarkdownFiles path)
function buildMarkdownFileUrl(siteUrl, urlPath) {
  const baseUrlNormalized = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  return `${baseUrlNormalized}/${urlPath}`;
}

// Test cases
const testCases = [
  {
    name: 'Root baseUrl produces no double slash',
    siteUrl: 'https://example.com/',
    urlPath: 'docs/intro.md',
    expected: 'https://example.com/docs/intro.md',
    description: 'siteUrl ending with / should not produce // when urlPath is appended'
  },
  {
    name: 'No trailing slash siteUrl remains correct',
    siteUrl: 'https://example.com',
    urlPath: 'docs/intro.md',
    expected: 'https://example.com/docs/intro.md',
    description: 'siteUrl without trailing slash should produce correct URL'
  },
  {
    name: 'siteUrl with subpath ending in slash produces no double slash',
    siteUrl: 'https://example.com/mysite/',
    urlPath: 'docs/api/core.md',
    expected: 'https://example.com/mysite/docs/api/core.md',
    description: 'siteUrl with sub-path ending in / should not produce //'
  },
  {
    name: 'siteUrl with subpath without trailing slash is correct',
    siteUrl: 'https://example.com/mysite',
    urlPath: 'docs/api/core.md',
    expected: 'https://example.com/mysite/docs/api/core.md',
    description: 'siteUrl with sub-path without trailing slash should produce correct URL'
  },
  {
    name: 'Root baseUrl with nested urlPath produces no double slash',
    siteUrl: 'https://example.com/',
    urlPath: 'guides/advanced/setup.md',
    expected: 'https://example.com/guides/advanced/setup.md',
    description: 'Deeply nested urlPath with root siteUrl should not produce //'
  },
  {
    name: 'URL with port and root slash produces no double slash',
    siteUrl: 'https://example.com:8080/',
    urlPath: 'docs/intro.md',
    expected: 'https://example.com:8080/docs/intro.md',
    description: 'siteUrl with port ending in / should not produce //'
  },
  {
    name: 'Generated URL does not contain double slash anywhere',
    siteUrl: 'https://example.com/',
    urlPath: 'docs/intro.md',
    check: (result) => !result.replace('://', '').includes('//'),
    description: 'The resulting URL must not contain // (excluding the protocol separator)'
  }
];

// Run tests
let passedTests = 0;
let failedTests = 0;

testCases.forEach((testCase, index) => {
  try {
    const result = buildMarkdownFileUrl(testCase.siteUrl, testCase.urlPath);

    if (testCase.check) {
      assert.ok(
        testCase.check(result),
        `URL "${result}" contains double slash (excluding protocol)`
      );
    } else {
      assert.strictEqual(
        result,
        testCase.expected,
        `Expected "${testCase.expected}" but got "${result}"`
      );
    }

    console.log(`✓ Test ${index + 1} passed: ${testCase.name}`);
    console.log(`  siteUrl: "${testCase.siteUrl}", urlPath: "${testCase.urlPath}"`);
    console.log(`  Result: "${result}"`);
    console.log(`  ${testCase.description}\n`);
    passedTests++;
  } catch (error) {
    console.error(`✗ Test ${index + 1} failed: ${testCase.name}`);
    console.error(`  siteUrl: "${testCase.siteUrl}", urlPath: "${testCase.urlPath}"`);
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

console.log('\n✓ All double-slash URL prevention tests passed!');
