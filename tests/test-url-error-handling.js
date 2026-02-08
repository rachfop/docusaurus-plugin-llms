/**
 * Test suite for URL constructor error handling
 *
 * Tests that URL construction errors are properly caught and handled:
 * - Invalid URL strings
 * - Malformed base URLs
 * - Special characters that break URL constructor
 * - Edge cases that could crash the build
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

console.log('Testing URL constructor error handling...\n');

/**
 * Simulates the URL construction logic from processor.ts with error handling
 */
function constructUrlWithResolvedUrl(resolvedUrl, siteUrl) {
  try {
    return new URL(resolvedUrl, siteUrl).toString();
  } catch (error) {
    console.warn(`Invalid URL construction: ${resolvedUrl} with base ${siteUrl}. Using fallback.`);
    // Fallback to string concatenation with proper path joining
    const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    const urlPath = resolvedUrl.startsWith('/') ? resolvedUrl : `/${resolvedUrl}`;
    return baseUrl + urlPath;
  }
}

/**
 * Simulates the URL construction logic from processor.ts for the fallback path
 */
function constructUrlWithFallback(siteUrl, pathPart) {
  try {
    const baseUrl = new URL(siteUrl);
    return `${baseUrl.origin}/${pathPart}`;
  } catch (error) {
    console.warn(`Invalid siteUrl: ${siteUrl}. Using fallback.`);
    // Fallback to string concatenation with proper path joining
    const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
    return `${baseUrl}/${pathPart}`;
  }
}

// Test cases for URL construction with resolvedUrl
const resolvedUrlTestCases = [
  {
    name: 'Valid URL construction',
    resolvedUrl: '/docs/intro',
    siteUrl: 'https://example.com',
    shouldSucceed: true,
    expectedOutput: 'https://example.com/docs/intro',
    description: 'Valid URLs should construct normally'
  },
  {
    name: 'Invalid characters in resolvedUrl',
    resolvedUrl: '/docs/<script>alert(1)</script>',
    siteUrl: 'https://example.com',
    shouldSucceed: true, // Should handle with fallback
    expectedPattern: /https:\/\/example\.com\/docs\//,
    description: 'Invalid characters should trigger fallback'
  },
  {
    name: 'Malformed siteUrl',
    resolvedUrl: '/docs/intro',
    siteUrl: 'not-a-valid-url',
    shouldSucceed: true, // Should handle with fallback
    expectedOutput: 'not-a-valid-url/docs/intro',
    description: 'Malformed siteUrl should use fallback'
  },
  {
    name: 'Empty resolvedUrl',
    resolvedUrl: '',
    siteUrl: 'https://example.com',
    shouldSucceed: true,
    expectedOutput: 'https://example.com/',
    description: 'Empty resolvedUrl should construct base URL'
  },
  {
    name: 'Special characters in path',
    resolvedUrl: '/docs/api/v1/test%20file',
    siteUrl: 'https://example.com',
    shouldSucceed: true,
    expectedPattern: /https:\/\/example\.com\/docs\/api\/v1\//,
    description: 'Special characters should be handled'
  },
  {
    name: 'Path with spaces',
    resolvedUrl: '/docs/my file',
    siteUrl: 'https://example.com',
    shouldSucceed: true,
    expectedPattern: /https:\/\/example\.com\/docs\//,
    description: 'Spaces in path should be handled'
  },
  {
    name: 'Unicode characters in path',
    resolvedUrl: '/docs/文档/test',
    siteUrl: 'https://example.com',
    shouldSucceed: true,
    expectedPattern: /https:\/\/example\.com\/docs\//,
    description: 'Unicode characters should be handled'
  },
  {
    name: 'Relative path without leading slash',
    resolvedUrl: 'docs/intro',
    siteUrl: 'https://example.com',
    shouldSucceed: true,
    expectedPattern: /https:\/\/example\.com/,
    description: 'Relative paths should be normalized'
  },
  {
    name: 'SiteUrl with trailing slash',
    resolvedUrl: '/docs/intro',
    siteUrl: 'https://example.com/',
    shouldSucceed: true,
    expectedPattern: /https:\/\/example\.com/,
    description: 'Trailing slashes should be handled'
  },
  {
    name: 'SiteUrl with port',
    resolvedUrl: '/docs/intro',
    siteUrl: 'https://example.com:3000',
    shouldSucceed: true,
    expectedOutput: 'https://example.com:3000/docs/intro',
    description: 'Ports should be preserved'
  },
  {
    name: 'Null-like strings',
    resolvedUrl: '/docs/null',
    siteUrl: 'https://example.com',
    shouldSucceed: true,
    expectedOutput: 'https://example.com/docs/null',
    description: 'Null-like strings should work'
  },
  {
    name: 'Very long path',
    resolvedUrl: '/docs/' + 'a'.repeat(2000),
    siteUrl: 'https://example.com',
    shouldSucceed: true,
    expectedPattern: /https:\/\/example\.com\/docs\//,
    description: 'Very long paths should be handled'
  }
];

// Test cases for fallback URL construction
const fallbackUrlTestCases = [
  {
    name: 'Valid siteUrl with path',
    siteUrl: 'https://example.com',
    pathPart: 'docs/intro',
    shouldSucceed: true,
    expectedOutput: 'https://example.com/docs/intro',
    description: 'Valid siteUrl should construct normally'
  },
  {
    name: 'Malformed siteUrl',
    siteUrl: 'not-a-url',
    pathPart: 'docs/intro',
    shouldSucceed: true, // Should handle with fallback
    expectedOutput: 'not-a-url/docs/intro',
    description: 'Malformed siteUrl should use fallback'
  },
  {
    name: 'Empty siteUrl',
    siteUrl: '',
    pathPart: 'docs/intro',
    shouldSucceed: true,
    expectedOutput: '/docs/intro',
    description: 'Empty siteUrl should use fallback'
  },
  {
    name: 'SiteUrl with subpath',
    siteUrl: 'https://example.com/app',
    pathPart: 'docs/intro',
    shouldSucceed: true,
    expectedOutput: 'https://example.com/docs/intro',
    description: 'SiteUrl with subpath should use origin'
  },
  {
    name: 'SiteUrl with query params',
    siteUrl: 'https://example.com?param=value',
    pathPart: 'docs/intro',
    shouldSucceed: true,
    expectedOutput: 'https://example.com/docs/intro',
    description: 'Query params in siteUrl should be ignored'
  },
  {
    name: 'SiteUrl with hash',
    siteUrl: 'https://example.com#section',
    pathPart: 'docs/intro',
    shouldSucceed: true,
    expectedOutput: 'https://example.com/docs/intro',
    description: 'Hash in siteUrl should be ignored'
  },
  {
    name: 'Special characters in siteUrl',
    siteUrl: 'https://example<>.com',
    pathPart: 'docs/intro',
    shouldSucceed: true, // Should handle with fallback
    expectedPattern: /docs\/intro/,
    description: 'Special characters should trigger fallback'
  }
];

// Run tests for resolvedUrl construction
console.log('Testing URL construction with resolvedUrl...\n');
let passedTests = 0;
let failedTests = 0;

resolvedUrlTestCases.forEach((testCase, index) => {
  try {
    const result = constructUrlWithResolvedUrl(testCase.resolvedUrl, testCase.siteUrl);

    if (testCase.shouldSucceed) {
      // Check if result matches expected output or pattern
      let matches = false;
      if (testCase.expectedOutput) {
        matches = result === testCase.expectedOutput;
        if (!matches) {
          throw new Error(`Expected "${testCase.expectedOutput}" but got "${result}"`);
        }
      } else if (testCase.expectedPattern) {
        matches = testCase.expectedPattern.test(result);
        if (!matches) {
          throw new Error(`Expected to match ${testCase.expectedPattern} but got "${result}"`);
        }
      } else {
        // Just verify it doesn't throw
        matches = true;
      }

      console.log(`✓ Test ${index + 1} passed: ${testCase.name}`);
      console.log(`  Input: resolvedUrl="${testCase.resolvedUrl}", siteUrl="${testCase.siteUrl}"`);
      console.log(`  Output: "${result}"`);
      console.log(`  ${testCase.description}\n`);
      passedTests++;
    }
  } catch (error) {
    console.error(`✗ Test ${index + 1} failed: ${testCase.name}`);
    console.error(`  Input: resolvedUrl="${testCase.resolvedUrl}", siteUrl="${testCase.siteUrl}"`);
    console.error(`  ${error.message}\n`);
    failedTests++;
  }
});

// Run tests for fallback construction
console.log('\nTesting URL construction with fallback path...\n');

fallbackUrlTestCases.forEach((testCase, index) => {
  try {
    const result = constructUrlWithFallback(testCase.siteUrl, testCase.pathPart);

    if (testCase.shouldSucceed) {
      // Check if result matches expected output or pattern
      let matches = false;
      if (testCase.expectedOutput) {
        matches = result === testCase.expectedOutput;
        if (!matches) {
          throw new Error(`Expected "${testCase.expectedOutput}" but got "${result}"`);
        }
      } else if (testCase.expectedPattern) {
        matches = testCase.expectedPattern.test(result);
        if (!matches) {
          throw new Error(`Expected to match ${testCase.expectedPattern} but got "${result}"`);
        }
      } else {
        // Just verify it doesn't throw
        matches = true;
      }

      console.log(`✓ Test ${index + resolvedUrlTestCases.length + 1} passed: ${testCase.name}`);
      console.log(`  Input: siteUrl="${testCase.siteUrl}", pathPart="${testCase.pathPart}"`);
      console.log(`  Output: "${result}"`);
      console.log(`  ${testCase.description}\n`);
      passedTests++;
    }
  } catch (error) {
    console.error(`✗ Test ${index + resolvedUrlTestCases.length + 1} failed: ${testCase.name}`);
    console.error(`  Input: siteUrl="${testCase.siteUrl}", pathPart="${testCase.pathPart}"`);
    console.error(`  ${error.message}\n`);
    failedTests++;
  }
});

// Summary
console.log('='.repeat(60));
console.log(`Test Summary:`);
console.log(`  Total tests: ${resolvedUrlTestCases.length + fallbackUrlTestCases.length}`);
console.log(`  Passed: ${passedTests}`);
console.log(`  Failed: ${failedTests}`);
console.log('='.repeat(60));

if (failedTests > 0) {
  process.exit(1);
}

console.log('\n✓ All URL error handling tests passed!');
