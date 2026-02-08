/**
 * Tests for URL encoding functionality
 *
 * Run with: node test-url-encoding.js
 */

const fs = require('fs');
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');

// Helper to create a test markdown file with content
async function createTestFile(filePath, content, frontMatter = {}) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let fileContent = '';

  // Add frontmatter if provided
  if (Object.keys(frontMatter).length > 0) {
    fileContent += '---\n';
    for (const [key, value] of Object.entries(frontMatter)) {
      fileContent += `${key}: ${value}\n`;
    }
    fileContent += '---\n\n';
  }

  fileContent += content;

  fs.writeFileSync(filePath, fileContent, 'utf-8');
}

// Helper to clean up test directory
function cleanupTestDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// Test cases for URL encoding
const testCases = [
  {
    name: 'Encodes spaces in filename',
    filename: 'hello world.md',
    expectedUrlPath: '/docs/hello%20world',
    content: '# Hello World\n\nThis is a test document with spaces in the filename.'
  },
  {
    name: 'Encodes unicode characters',
    filename: 'über.md',
    expectedUrlPath: '/docs/%C3%BCber',
    content: '# Über\n\nThis document has unicode characters in the filename.'
  },
  {
    name: 'Encodes special characters - hash',
    filename: 'file#1.md',
    expectedUrlPath: '/docs/file%231',
    content: '# File #1\n\nThis document has a hash in the filename.'
  },
  {
    name: 'Encodes special characters - question mark',
    filename: 'what?.md',
    expectedUrlPath: '/docs/what%3F',
    content: '# What?\n\nThis document has a question mark in the filename.'
  },
  {
    name: 'Encodes special characters - ampersand',
    filename: 'rock&roll.md',
    expectedUrlPath: '/docs/rock%26roll',
    content: '# Rock & Roll\n\nThis document has an ampersand in the filename.'
  },
  {
    name: 'Encodes spaces in nested path',
    filename: 'my folder/my file.md',
    expectedUrlPath: '/docs/my%20folder/my%20file',
    content: '# Nested File\n\nThis is a nested file with spaces in both directory and filename.'
  },
  {
    name: 'Encodes multiple special characters',
    filename: 'hello world & über.md',
    expectedUrlPath: '/docs/hello%20world%20%26%20%C3%BCber',
    content: '# Complex Filename\n\nThis has multiple special characters.'
  },
  {
    name: 'Preserves already encoded segments',
    filename: 'hello%20world.md',
    expectedUrlPath: '/docs/hello%20world',
    content: '# Pre-encoded\n\nThis filename is already URL encoded.'
  },
  {
    name: 'Handles parentheses',
    filename: 'file (version 2).md',
    expectedUrlPath: '/docs/file%20(version%202)',
    content: '# File Version 2\n\nThis has parentheses in the filename.'
  },
  {
    name: 'Handles plus signs',
    filename: 'C++.md',
    expectedUrlPath: '/docs/C%2B%2B',
    content: '# C++\n\nThis is about C++ programming.'
  },
  {
    name: 'Normal filename without special characters',
    filename: 'normal-file.md',
    expectedUrlPath: '/docs/normal-file',
    content: '# Normal File\n\nThis has no special characters.'
  },
  {
    name: 'Encodes equals sign',
    filename: 'math=fun.md',
    expectedUrlPath: '/docs/math%3Dfun',
    content: '# Math = Fun\n\nThis has an equals sign in the filename.'
  },
  {
    name: 'Prevents double-encoding of already encoded spaces',
    filename: 'hello%20world.md',
    expectedUrlPath: '/docs/hello%20world',
    content: '# Pre-encoded Spaces\n\nThis filename has already encoded spaces.'
  },
  {
    name: 'Prevents double-encoding of already encoded special chars',
    filename: 'rock%26roll.md',
    expectedUrlPath: '/docs/rock%26roll',
    content: '# Pre-encoded Ampersand\n\nThis filename has already encoded ampersand.'
  },
  {
    name: 'Handles mixed encoded and unencoded segments',
    filename: 'hello%20world/test file.md',
    expectedUrlPath: '/docs/hello%20world/test%20file',
    content: '# Mixed Encoding\n\nFirst segment encoded, second not.'
  },
  {
    name: 'Handles unreserved characters without encoding',
    filename: 'test-file_name.md',
    expectedUrlPath: '/docs/test-file_name',
    content: '# Unreserved Characters\n\nDashes and underscores should not be encoded.'
  },
  {
    name: 'Handles tilde character (unreserved)',
    filename: 'file~backup.md',
    expectedUrlPath: '/docs/file~backup',
    content: '# Tilde Character\n\nTilde is an unreserved character.'
  },
  {
    name: 'Preserves valid partial encoding',
    filename: 'bad%2encoding.md',
    expectedUrlPath: '/docs/bad%2encoding',
    content: '# Partial Encoding\n\nThis has valid percent encoding (%2e) and is preserved.'
  },
  {
    name: 'Encodes brackets',
    filename: 'test[1].md',
    expectedUrlPath: '/docs/test%5B1%5D',
    content: '# Brackets\n\nThis has square brackets in the filename.'
  },
  {
    name: 'Encodes pipe character',
    filename: 'option|value.md',
    expectedUrlPath: '/docs/option%7Cvalue',
    content: '# Pipe Character\n\nThis has a pipe in the filename.'
  },
  {
    name: 'Preserves already encoded unicode',
    filename: '%C3%BCber.md',
    expectedUrlPath: '/docs/%C3%BCber',
    content: '# Pre-encoded Unicode\n\nThis is über pre-encoded.'
  },
  {
    name: 'Handles semicolon',
    filename: 'key;value.md',
    expectedUrlPath: '/docs/key%3Bvalue',
    content: '# Semicolon\n\nThis has a semicolon in the filename.'
  },
  {
    name: 'Handles comma',
    filename: 'one,two,three.md',
    expectedUrlPath: '/docs/one%2Ctwo%2Cthree',
    content: '# Comma\n\nThis has commas in the filename.'
  },
  {
    name: 'Handles truly malformed encoding',
    filename: 'bad%ZZencoding.md',
    expectedUrlPath: '/docs/bad%25ZZencoding',
    content: '# Truly Malformed\n\nThis has truly malformed percent encoding that will throw an error.'
  }
];

async function runUrlEncodingTests() {
  console.log('Running URL encoding tests...\n');

  const testDir = path.join(__dirname, 'test-url-encoding');
  const baseDir = path.join(testDir, 'docs');
  const siteUrl = 'https://example.com';
  let passed = 0;
  let failed = 0;

  try {
    // Create test directory
    cleanupTestDirectory(testDir);
    fs.mkdirSync(baseDir, { recursive: true });

    for (const testCase of testCases) {
      console.log(`Test: ${testCase.name}`);

      try {
        // Create the test file
        const filePath = path.join(baseDir, testCase.filename);
        await createTestFile(filePath, testCase.content);

        // Process the markdown file
        const docInfo = await processMarkdownFile(
          filePath,
          baseDir,
          siteUrl,
          'docs'
        );

        // Validate the URL
        const expectedUrl = `${siteUrl}${testCase.expectedUrlPath}`;
        if (docInfo.url !== expectedUrl) {
          throw new Error(
            `Expected URL "${expectedUrl}", got "${docInfo.url}"`
          );
        }

        // Validate that the URL is properly encoded by attempting to construct it
        try {
          const parsedUrl = new URL(docInfo.url);
          if (parsedUrl.toString() !== expectedUrl) {
            throw new Error('URL parsing mismatch');
          }
        } catch (urlError) {
          throw new Error(`Generated URL is invalid: ${urlError.message}`);
        }

        console.log(`✅ PASS - Generated URL: ${docInfo.url}`);
        passed++;

      } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
      }
    }
  } finally {
    cleanupTestDirectory(testDir);
  }

  console.log(`\n========================================`);
  console.log(`URL Encoding Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runUrlEncodingTests().then(success => {
  console.log(success ? '🎉 All URL encoding tests passed!' : '❌ Some URL encoding tests failed.');
  if (!success) process.exit(1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
