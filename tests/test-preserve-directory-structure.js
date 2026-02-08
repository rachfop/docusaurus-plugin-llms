/**
 * Tests for preserveDirectoryStructure option
 *
 * Run with: node test-preserve-directory-structure.js
 */

const fs = require('fs');
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

// Helper function to clean up test directory with nested structure
async function cleanupTestDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // Recreate empty directory for next test
  fs.mkdirSync(dir, { recursive: true });
}

// Test cases for preserveDirectoryStructure option
const testCases = [
  {
    name: 'preserveDirectoryStructure: true (default) - preserves full path including docs/',
    docs: [
      {
        title: 'Server Configuration',
        path: 'docs/server/config.md',
        content: 'Server configuration documentation.',
        description: 'How to configure the server',
        url: 'https://example.com/docs/server/config'
      }
    ],
    preserveDirectoryStructure: true,
    expectedPaths: ['docs/server/config.md'],
    expectedUrls: ['https://example.com/docs/server/config.md'],
    siteUrl: 'https://example.com',
    docsDir: 'docs'
  },
  {
    name: 'preserveDirectoryStructure: false - strips docs/ prefix (old behavior)',
    docs: [
      {
        title: 'Server Configuration',
        path: 'docs/server/config.md',
        content: 'Server configuration documentation.',
        description: 'How to configure the server',
        url: 'https://example.com/docs/server/config'
      }
    ],
    preserveDirectoryStructure: false,
    expectedPaths: ['server/config.md'],
    expectedUrls: ['https://example.com/server/config.md'],
    siteUrl: 'https://example.com',
    docsDir: 'docs'
  },
  {
    name: 'preserveDirectoryStructure: true - multiple nested files',
    docs: [
      {
        title: 'Getting Started',
        path: 'docs/getting-started.md',
        content: 'Getting started guide.',
        description: 'Quick start guide',
        url: 'https://example.com/docs/getting-started'
      },
      {
        title: 'API Reference',
        path: 'docs/api/reference.md',
        content: 'API documentation.',
        description: 'API reference',
        url: 'https://example.com/docs/api/reference'
      },
      {
        title: 'Database Setup',
        path: 'docs/server/database/setup.md',
        content: 'Database setup instructions.',
        description: 'How to set up the database',
        url: 'https://example.com/docs/server/database/setup'
      }
    ],
    preserveDirectoryStructure: true,
    expectedPaths: [
      'docs/getting-started.md',
      'docs/api/reference.md',
      'docs/server/database/setup.md'
    ],
    expectedUrls: [
      'https://example.com/docs/getting-started.md',
      'https://example.com/docs/api/reference.md',
      'https://example.com/docs/server/database/setup.md'
    ],
    siteUrl: 'https://example.com',
    docsDir: 'docs'
  },
  {
    name: 'preserveDirectoryStructure: false - multiple nested files',
    docs: [
      {
        title: 'Getting Started',
        path: 'docs/getting-started.md',
        content: 'Getting started guide.',
        description: 'Quick start guide',
        url: 'https://example.com/docs/getting-started'
      },
      {
        title: 'API Reference',
        path: 'docs/api/reference.md',
        content: 'API documentation.',
        description: 'API reference',
        url: 'https://example.com/docs/api/reference'
      },
      {
        title: 'Database Setup',
        path: 'docs/server/database/setup.md',
        content: 'Database setup instructions.',
        description: 'How to set up the database',
        url: 'https://example.com/docs/server/database/setup'
      }
    ],
    preserveDirectoryStructure: false,
    expectedPaths: [
      'getting-started.md',
      'api/reference.md',
      'server/database/setup.md'
    ],
    expectedUrls: [
      'https://example.com/getting-started.md',
      'https://example.com/api/reference.md',
      'https://example.com/server/database/setup.md'
    ],
    siteUrl: 'https://example.com',
    docsDir: 'docs'
  },
  {
    name: 'preserveDirectoryStructure: true - custom docsDir name (documentation)',
    docs: [
      {
        title: 'Tutorial',
        path: 'documentation/tutorials/basic.md',
        content: 'Basic tutorial content.',
        description: 'Basic tutorial',
        url: 'https://example.com/documentation/tutorials/basic'
      }
    ],
    preserveDirectoryStructure: true,
    expectedPaths: ['documentation/tutorials/basic.md'],
    expectedUrls: ['https://example.com/documentation/tutorials/basic.md'],
    siteUrl: 'https://example.com',
    docsDir: 'documentation'
  },
  {
    name: 'preserveDirectoryStructure: false - custom docsDir name (documentation)',
    docs: [
      {
        title: 'Tutorial',
        path: 'documentation/tutorials/basic.md',
        content: 'Basic tutorial content.',
        description: 'Basic tutorial',
        url: 'https://example.com/documentation/tutorials/basic'
      }
    ],
    preserveDirectoryStructure: false,
    expectedPaths: ['tutorials/basic.md'],
    expectedUrls: ['https://example.com/tutorials/basic.md'],
    siteUrl: 'https://example.com',
    docsDir: 'documentation'
  },
  {
    name: 'preserveDirectoryStructure: true - with frontmatter slug',
    docs: [
      {
        title: 'Configuration Guide',
        path: 'docs/advanced/config.md',
        content: 'Configuration guide.',
        description: 'Advanced configuration',
        url: 'https://example.com/docs/advanced/config',
        frontMatter: {
          slug: 'custom-config'
        }
      }
    ],
    preserveDirectoryStructure: true,
    expectedPaths: ['docs/advanced/custom-config.md'],
    expectedUrls: ['https://example.com/docs/advanced/custom-config.md'],
    siteUrl: 'https://example.com',
    docsDir: 'docs'
  },
  {
    name: 'preserveDirectoryStructure: false - with frontmatter slug',
    docs: [
      {
        title: 'Configuration Guide',
        path: 'docs/advanced/config.md',
        content: 'Configuration guide.',
        description: 'Advanced configuration',
        url: 'https://example.com/docs/advanced/config',
        frontMatter: {
          slug: 'custom-config'
        }
      }
    ],
    preserveDirectoryStructure: false,
    expectedPaths: ['advanced/custom-config.md'],
    expectedUrls: ['https://example.com/advanced/custom-config.md'],
    siteUrl: 'https://example.com',
    docsDir: 'docs'
  },
  {
    name: 'preserveDirectoryStructure: true - with nested frontmatter slug',
    docs: [
      {
        title: 'API Guide',
        path: 'docs/api/guide.md',
        content: 'API guide.',
        description: 'API usage guide',
        url: 'https://example.com/docs/api/guide',
        frontMatter: {
          slug: 'v2/api-guide'
        }
      }
    ],
    preserveDirectoryStructure: true,
    // When slug contains /, it replaces the entire path with slug (current behavior)
    // but preserveDirectoryStructure only affects initial path processing, not slug handling
    expectedPaths: ['v2/api-guide.md'],
    expectedUrls: ['https://example.com/v2/api-guide.md'],
    siteUrl: 'https://example.com',
    docsDir: 'docs'
  },
  {
    name: 'preserveDirectoryStructure: false - with nested frontmatter slug',
    docs: [
      {
        title: 'API Guide',
        path: 'docs/api/guide.md',
        content: 'API guide.',
        description: 'API usage guide',
        url: 'https://example.com/docs/api/guide',
        frontMatter: {
          slug: 'v2/api-guide'
        }
      }
    ],
    preserveDirectoryStructure: false,
    expectedPaths: ['v2/api-guide.md'],
    expectedUrls: ['https://example.com/v2/api-guide.md'],
    siteUrl: 'https://example.com',
    docsDir: 'docs'
  }
];

async function runPreserveDirectoryStructureTests() {
  console.log('Running preserveDirectoryStructure option tests...\n');

  let passed = 0;
  let failed = 0;

  // Create a temporary test directory
  const testDir = path.join(__dirname, 'test-preserve-dir-structure');

  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  try {
    for (const testCase of testCases) {
      console.log(`Test: ${testCase.name}`);

      try {
        // Generate individual markdown files
        const result = await generateIndividualMarkdownFiles(
          testCase.docs,
          testDir,
          testCase.siteUrl,
          testCase.docsDir,
          [], // No frontmatter preservation for these tests
          testCase.preserveDirectoryStructure
        );

        // Check that the expected files were created at the correct paths
        let pathsCorrect = true;

        for (let i = 0; i < testCase.expectedPaths.length; i++) {
          const expectedPath = testCase.expectedPaths[i];
          const fullPath = path.join(testDir, expectedPath);

          if (!fs.existsSync(fullPath)) {
            console.log(`❌ FAIL - Expected file at path "${expectedPath}" not found`);
            console.log(`   Full path checked: ${fullPath}`);
            pathsCorrect = false;
            break;
          }
        }

        if (!pathsCorrect) {
          failed++;
          // Clean up for next test
          await cleanupTestDirectory(testDir);
          continue;
        }

        // Check URL generation in returned docs
        let urlsCorrect = true;
        for (let i = 0; i < result.length; i++) {
          const doc = result[i];
          const expectedUrl = testCase.expectedUrls[i];
          if (doc.url !== expectedUrl) {
            console.log(`❌ FAIL - Expected URL "${expectedUrl}", got "${doc.url}"`);
            urlsCorrect = false;
            break;
          }
        }

        if (!urlsCorrect) {
          failed++;
          await cleanupTestDirectory(testDir);
          continue;
        }

        // Check path updates in returned docs
        let docPathsCorrect = true;
        for (let i = 0; i < result.length; i++) {
          const doc = result[i];
          const expectedPath = `/${testCase.expectedPaths[i]}`;
          if (doc.path !== expectedPath) {
            console.log(`❌ FAIL - Expected doc path "${expectedPath}", got "${doc.path}"`);
            docPathsCorrect = false;
            break;
          }
        }

        if (!docPathsCorrect) {
          failed++;
          await cleanupTestDirectory(testDir);
          continue;
        }

        // Check file contents
        let contentsCorrect = true;
        for (let i = 0; i < testCase.expectedPaths.length; i++) {
          const expectedPath = testCase.expectedPaths[i];
          const filepath = path.join(testDir, expectedPath);

          const fileContent = fs.readFileSync(filepath, 'utf-8');
          const originalDoc = testCase.docs[i];

          // Check that file contains expected elements
          if (!fileContent.includes(`# ${originalDoc.title}`)) {
            console.log(`❌ FAIL - File content missing title: "${originalDoc.title}"`);
            contentsCorrect = false;
            break;
          }

          if (originalDoc.description && !fileContent.includes(`> ${originalDoc.description}`)) {
            console.log(`❌ FAIL - File content missing description: "${originalDoc.description}"`);
            contentsCorrect = false;
            break;
          }

          if (!fileContent.includes(originalDoc.content)) {
            console.log(`❌ FAIL - File content missing original content`);
            contentsCorrect = false;
            break;
          }
        }

        if (contentsCorrect) {
          console.log(`✅ PASS`);
          passed++;
        } else {
          failed++;
        }

        // Clean up for next test
        await cleanupTestDirectory(testDir);

      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        console.error(error.stack);
        failed++;
        await cleanupTestDirectory(testDir);
      }
    }
  } finally {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`preserveDirectoryStructure Tests Summary:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Test edge case: undefined parameter defaults to true (preserves directory structure)
async function testDefaultBehavior() {
  console.log('Testing default behavior (undefined parameter)...\n');

  const testDir = path.join(__dirname, 'test-default-behavior');

  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  try {
    console.log('Test: Default parameter should preserve directory structure');

    const docs = [
      {
        title: 'Test Doc',
        path: 'docs/test/doc.md',
        content: 'Test content.',
        description: 'Test description',
        url: 'https://example.com/docs/test/doc'
      }
    ];

    // Call without the preserveDirectoryStructure parameter (should default to true)
    const result = await generateIndividualMarkdownFiles(
      docs,
      testDir,
      'https://example.com',
      'docs',
      [] // No frontmatter preservation
      // Note: preserveDirectoryStructure parameter is omitted
    );

    // Should preserve the docs/ prefix (new default behavior)
    const expectedPath = 'docs/test/doc.md';
    const fullPath = path.join(testDir, expectedPath);

    if (fs.existsSync(fullPath)) {
      console.log(`✅ PASS - Default behavior preserves directory structure`);
      fs.rmSync(testDir, { recursive: true });
      return true;
    } else {
      console.log(`❌ FAIL - Expected file at "${expectedPath}" not found`);
      fs.rmSync(testDir, { recursive: true });
      return false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const mainTestsPass = await runPreserveDirectoryStructureTests();
  const defaultTestPass = await testDefaultBehavior();

  if (mainTestsPass && defaultTestPass) {
    console.log('🎉 All preserveDirectoryStructure tests passed!');
  } else {
    console.log('❌ Some preserveDirectoryStructure tests failed.');
    process.exit(1);
  }
}

// Execute tests
runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
