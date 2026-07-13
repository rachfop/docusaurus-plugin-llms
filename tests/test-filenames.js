/**
 * Tests for filename generation functionality
 *
 * Run with: node test-filenames.js
 */

const fs = require('fs');
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

// Helper to create a test document
function createTestDoc(filename, frontMatter = {}) {
  const baseName = path.basename(filename, '.md');
  const dir = path.dirname(filename) === '.' ? '' : path.dirname(filename);
  
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

// Helper to check if expected file exists and fallback doesn't
function validateFilePaths(testDir, expectedPath, fallbackPath) {
  const expectedFullPath = path.join(testDir, expectedPath);
  const fallbackFullPath = path.join(testDir, fallbackPath);
  
  if (!fs.existsSync(expectedFullPath)) {
    throw new Error(`Expected file at path "${expectedPath}" not found`);
  }
  
  if (expectedPath !== fallbackPath && fs.existsSync(fallbackFullPath)) {
    throw new Error(`Fallback file at path "${fallbackPath}" should not exist when frontmatter is used`);
  }
}

// Simplified test cases
const testCases = [
  {
    name: 'Uses slug for filename when slug present',
    doc: createTestDoc('guides/config.md', { slug: 'custom-config-slug' }),
    expectedPath: 'guides/custom-config-slug.md',
    fallbackPath: 'guides/config.md'
  },
  {
    name: 'Prioritizes slug over id when both present',
    doc: createTestDoc('api/reference.md', { slug: 'api-slug', id: 'api-id' }),
    expectedPath: 'api/api-slug.md', 
    fallbackPath: 'api/reference.md'
  },
  {
    name: 'Uses id for filename when only id present',
    doc: createTestDoc('tutorials/basic.md', { id: 'tutorial-basic-id' }),
    expectedPath: 'tutorials/tutorial-basic-id.md',
    fallbackPath: 'tutorials/basic.md'
  },
  {
    name: 'Uses original filename when no slug or id',
    doc: createTestDoc('getting-started.md', { sidebar_position: 1, tags: ['guide'] }),
    expectedPath: 'getting-started.md',
    fallbackPath: 'getting-started.md'
  }
];

// Numeric prefix stripping tests
//
// These use realistic Docusaurus URLs (no .md extension, numeric prefixes
// already stripped by routing OR present in fallback paths).
//
const numericPrefixTestCases = [
  {
    name: 'Strips numeric prefix from URL-derived path',
    doc: {
      title: 'Getting Started',
      path: 'docs/01-introduction/01-getting-started.md',
      content: 'content',
      description: 'desc',
      url: 'https://example.com/docs/01-introduction/01-getting-started',
      frontMatter: {}
    },
    expectedPath: 'docs/introduction/getting-started.md',
    expectedUrl: 'https://example.com/docs/introduction/getting-started.md',
    preserveDirectoryStructure: true,
  },
  {
    name: 'Strips numeric prefix from deeply nested URL',
    doc: {
      title: 'Install',
      path: 'docs/02-guide/03-setup/04-install.md',
      content: 'content',
      description: 'desc',
      url: 'https://example.com/docs/02-guide/03-setup/04-install',
      frontMatter: {}
    },
    expectedPath: 'docs/guide/setup/install.md',
    expectedUrl: 'https://example.com/docs/guide/setup/install.md',
    preserveDirectoryStructure: true,
  },
  {
    name: 'Leaves non-prefixed segments untouched',
    doc: {
      title: 'Reference',
      path: 'docs/api/reference.md',
      content: 'content',
      description: 'desc',
      url: 'https://example.com/docs/api/reference',
      frontMatter: {}
    },
    expectedPath: 'docs/api/reference.md',
    expectedUrl: 'https://example.com/docs/api/reference.md',
    preserveDirectoryStructure: true,
  },
  {
    name: 'Fallback path strips numeric prefix when no URL',
    doc: {
      title: 'Getting Started',
      path: 'docs/01-introduction/01-getting-started.md',
      content: 'content',
      description: 'desc',
      url: '',
      frontMatter: {}
    },
    expectedPath: 'introduction/getting-started.md',
    expectedUrl: 'https://example.com/introduction/getting-started.md',
    preserveDirectoryStructure: false,
  },
];

async function runFilenameTests() {
  console.log('Running filename tests...\n');
  
  const testDir = path.join(__dirname, 'test-filenames');
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
          false // preserveDirectoryStructure = false
        );

        // Validate file paths
        validateFilePaths(testDir, testCase.expectedPath, testCase.fallbackPath);
        
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
    }

    console.log('\n--- Numeric prefix stripping tests ---\n');

    for (const testCase of numericPrefixTestCases) {
      console.log(`Test: ${testCase.name}`);

      try {
        cleanupTestDirectory(testDir);

        const preserve = testCase.preserveDirectoryStructure !== false;
        const result = await generateIndividualMarkdownFiles(
          [testCase.doc],
          testDir,
          siteUrl,
          'docs',
          [],
          preserve
        );

        const expectedFullPath = path.join(testDir, testCase.expectedPath);
        if (!fs.existsSync(expectedFullPath)) {
          throw new Error(`Expected file at path "${testCase.expectedPath}" not found`);
        }

        if (result[0].url !== testCase.expectedUrl) {
          throw new Error(`Expected URL "${testCase.expectedUrl}", got "${result[0].url}"`);
        }

        console.log(`✅ PASS`);
        passed++;
      } catch (error) {
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
      }
    }

  } finally {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }

  console.log(`\n========================================`);
  console.log(`Filename Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runFilenameTests().then(success => {
  console.log(success ? '🎉 All filename tests passed!' : '❌ Some filename tests failed.');
  if (!success) process.exit(1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
