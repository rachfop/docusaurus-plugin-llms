/**
 * Tests for nested slug/ID path handling functionality
 *
 * This test ensures that slugs and IDs containing "/" are correctly
 * handled as nested directory structures.
 *
 * Run with: node test-nested-paths.js
 */

const fs = require('fs');
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

// Helper to create a test document
function createTestDoc(filename, frontMatter = {}) {
  const baseName = path.basename(filename, '.md');

  return {
    title: `${baseName} Title`,
    path: `docs/${filename}`,
    content: `This is ${baseName} content.`,
    description: `${baseName} documentation`,
    url: `https://example.com/docs/${filename}`,
    frontMatter
  };
}

// Helper to clean up test directory
function cleanupTestDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });
}

// Helper to check if expected file exists
function validateFilePath(testDir, expectedPath) {
  const expectedFullPath = path.join(testDir, expectedPath);

  if (!fs.existsSync(expectedFullPath)) {
    throw new Error(`Expected file at path "${expectedPath}" not found`);
  }

  // Also verify the content was written correctly
  const content = fs.readFileSync(expectedFullPath, 'utf-8');
  if (!content.includes('content')) {
    throw new Error(`File at "${expectedPath}" exists but has invalid content`);
  }
}

// Helper to check that a file does NOT exist
function validateFileDoesNotExist(testDir, filePath) {
  const fullPath = path.join(testDir, filePath);
  if (fs.existsSync(fullPath)) {
    throw new Error(`File should not exist at path "${filePath}"`);
  }
}

// Test cases for nested path handling
const testCases = [
  {
    name: 'Nested slug with single level creates directory',
    doc: createTestDoc('guides/config.md', { slug: 'api/config' }),
    expectedPath: 'api/config.md',
    shouldNotExist: ['guides/config.md', 'guides/api/config.md']
  },
  {
    name: 'Nested slug with multiple levels creates deep directory structure',
    doc: createTestDoc('old/location.md', { slug: 'api/core/auth' }),
    expectedPath: 'api/core/auth.md',
    shouldNotExist: ['old/location.md', 'old/api/core/auth.md']
  },
  {
    name: 'Nested slug with leading slash is trimmed',
    doc: createTestDoc('guides/config.md', { slug: '/api/config' }),
    expectedPath: 'api/config.md',
    shouldNotExist: ['guides/config.md']
  },
  {
    name: 'Nested slug with trailing slash is trimmed',
    doc: createTestDoc('guides/config.md', { slug: 'api/config/' }),
    expectedPath: 'api/config.md',
    shouldNotExist: ['guides/config.md']
  },
  {
    name: 'Nested slug with both leading and trailing slashes is trimmed',
    doc: createTestDoc('guides/config.md', { slug: '/api/config/' }),
    expectedPath: 'api/config.md',
    shouldNotExist: ['guides/config.md']
  },
  {
    name: 'Simple slug (no slash) only changes filename, keeps parent dirs',
    doc: createTestDoc('guides/getting-started/intro.md', { slug: 'simple-intro' }),
    expectedPath: 'guides/getting-started/simple-intro.md',
    shouldNotExist: ['guides/getting-started/intro.md', 'simple-intro.md']
  },
  {
    name: 'Nested ID with single level creates directory',
    doc: createTestDoc('guides/config.md', { id: 'api/config' }),
    expectedPath: 'api/config.md',
    shouldNotExist: ['guides/config.md']
  },
  {
    name: 'Nested ID with multiple levels creates deep directory structure',
    doc: createTestDoc('old/location.md', { id: 'api/v2/endpoints' }),
    expectedPath: 'api/v2/endpoints.md',
    shouldNotExist: ['old/location.md']
  },
  {
    name: 'Simple ID (no slash) only changes filename, keeps parent dirs',
    doc: createTestDoc('tutorials/advanced/oauth.md', { id: 'simple-oauth' }),
    expectedPath: 'tutorials/advanced/simple-oauth.md',
    shouldNotExist: ['tutorials/advanced/oauth.md', 'simple-oauth.md']
  },
  {
    name: 'Slug takes precedence over ID when both are nested',
    doc: createTestDoc('old/file.md', { slug: 'api/slug-path', id: 'api/id-path' }),
    expectedPath: 'api/slug-path.md',
    shouldNotExist: ['api/id-path.md', 'old/file.md']
  },
  {
    name: 'Slug takes precedence over ID when slug is nested and ID is simple',
    doc: createTestDoc('guides/file.md', { slug: 'api/nested', id: 'simple' }),
    expectedPath: 'api/nested.md',
    shouldNotExist: ['guides/simple.md', 'guides/file.md']
  },
  {
    name: 'Original path is used when no slug or ID present',
    doc: createTestDoc('guides/installation.md', { sidebar_position: 1 }),
    expectedPath: 'guides/installation.md',
    shouldNotExist: []
  },
  {
    name: 'Handles deeply nested slug with many levels',
    doc: createTestDoc('intro.md', { slug: 'v2/api/resources/users/permissions' }),
    expectedPath: 'v2/api/resources/users/permissions.md',
    shouldNotExist: ['intro.md']
  },
  {
    name: 'Nested slug with spaces in path segments',
    doc: createTestDoc('guide.md', { slug: 'api/user management/settings' }),
    expectedPath: 'api/user management/settings.md',
    shouldNotExist: ['guide.md']
  },
  {
    name: 'Empty slug after trimming slashes uses original path',
    doc: createTestDoc('guides/intro.md', { slug: '///' }),
    expectedPath: 'guides/intro.md', // Should fallback since slug becomes empty after trimming
    shouldNotExist: []
  }
];

async function runNestedPathTests() {
  console.log('Running nested path handling tests...\n');

  const testDir = path.join(__dirname, 'test-nested-paths');
  const siteUrl = 'https://example.com';
  let passed = 0;
  let failed = 0;

  try {
    for (const testCase of testCases) {
      console.log(`Test: ${testCase.name}`);

      try {
        cleanupTestDirectory(testDir);

        const result = await generateIndividualMarkdownFiles(
          [testCase.doc],
          testDir,
          siteUrl,
          'docs',
          [],
          false // preserveDirectoryStructure = false, which strips the 'docs/' prefix
        );

        // Validate expected file exists
        validateFilePath(testDir, testCase.expectedPath);

        // Validate files that should NOT exist
        for (const shouldNotExistPath of testCase.shouldNotExist) {
          validateFileDoesNotExist(testDir, shouldNotExistPath);
        }

        // Validate URL
        const expectedUrl = `${siteUrl}/${testCase.expectedPath}`;
        if (result[0].url !== expectedUrl) {
          throw new Error(`Expected URL "${expectedUrl}", got "${result[0].url}"`);
        }

        console.log(`✅ PASS`);
        passed++;

      } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
      }

      console.log(''); // Empty line between tests
    }
  } finally {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }

  console.log(`========================================`);
  console.log(`Nested Path Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runNestedPathTests().then(success => {
  console.log(success ? '🎉 All nested path tests passed!' : '❌ Some nested path tests failed.');
  if (!success) process.exit(1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
