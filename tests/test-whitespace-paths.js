/**
 * Tests for whitespace-only string handling in path operations
 *
 * Run with: node test-whitespace-paths.js
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

/**
 * Helper to create a temporary directory for testing
 */
function createTempDir() {
  const tmpDir = path.join(os.tmpdir(), `test-whitespace-paths-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

/**
 * Helper to clean up temporary directory
 */
function cleanupTempDir(tmpDir) {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Test cases for whitespace-only paths
 */
const testCases = [
  {
    name: 'Handles whitespace-only path',
    doc: {
      title: 'Test Document',
      description: 'Test description',
      content: 'Test content',
      url: 'https://example.com/test',
      path: '   ',  // Whitespace-only
      frontMatter: {}
    },
    expectedFilename: 'test-document.md'
  },
  {
    name: 'Handles tabs-only path',
    doc: {
      title: 'Another Document',
      description: 'Another description',
      content: 'Another content',
      url: 'https://example.com/another',
      path: '\t\t\t',  // Tabs-only
      frontMatter: {}
    },
    expectedFilename: 'another-document.md'
  },
  {
    name: 'Handles mixed whitespace path',
    doc: {
      title: 'Mixed Whitespace Doc',
      description: 'Mixed description',
      content: 'Mixed content',
      url: 'https://example.com/mixed',
      path: ' \t \n ',  // Mixed whitespace
      frontMatter: {}
    },
    expectedFilename: 'mixed-whitespace-doc.md'
  },
  {
    name: 'Handles whitespace around .md',
    doc: {
      title: 'Extension Test',
      description: 'Extension description',
      content: 'Extension content',
      url: 'https://example.com/ext',
      path: '  .md  ',  // Whitespace around .md
      frontMatter: {}
    },
    expectedFilename: 'extension-test.md'
  },
  {
    name: 'Handles normal path correctly',
    doc: {
      title: 'Normal Path',
      description: 'Normal description',
      content: 'Normal content',
      url: 'https://example.com/normal',
      path: 'docs/normal-doc.md',
      frontMatter: {}
    },
    expectedFilename: 'docs/normal-doc.md'
  },
  {
    name: 'Handles path with leading/trailing whitespace',
    doc: {
      title: 'Trimmed Path',
      description: 'Trimmed description',
      content: 'Trimmed content',
      url: 'https://example.com/trimmed',
      path: '  docs/valid-path.md  ',  // Should work after trim
      frontMatter: {}
    },
    expectedFilename: 'docs/valid-path.md'
  },
  {
    name: 'Handles empty string path',
    doc: {
      title: 'Empty Path Doc',
      description: 'Empty description',
      content: 'Empty content',
      url: 'https://example.com/empty',
      path: '',
      frontMatter: {}
    },
    expectedFilename: 'empty-path-doc.md'
  },
  {
    name: 'Handles null path with whitespace slug',
    doc: {
      title: 'Null Path With Slug',
      description: 'Null path description',
      content: 'Null path content',
      url: 'https://example.com/null',
      path: 'docs/original.md',
      frontMatter: {
        slug: '   '  // Whitespace-only slug - should be ignored
      }
    },
    expectedFilename: 'docs/original.md'  // Should keep original path when slug is invalid
  },
  {
    name: 'Handles null path with whitespace id',
    doc: {
      title: 'Null Path With ID',
      description: 'Null path id description',
      content: 'Null path id content',
      url: 'https://example.com/nullid',
      path: 'docs/original.md',
      frontMatter: {
        id: '\t\t'  // Whitespace-only id - should be ignored
      }
    },
    expectedFilename: 'docs/original.md'  // Should keep original path when id is invalid
  }
];

async function runTests() {
  console.log('Running whitespace path handling tests...\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const tmpDir = createTempDir();

    try {
      const docs = [testCase.doc];
      const result = await generateIndividualMarkdownFiles(
        docs,
        tmpDir,
        'https://example.com',
        'docs',
        [],
        true // preserveDirectoryStructure
      );

      // Check that a file was generated
      if (result.length === 0) {
        throw new Error('No files generated');
      }

      // Get the generated file path
      const generatedPath = result[0].path.replace(/^\/+/, '');

      // Check if the expected filename is in the generated path
      const expectedPath = testCase.expectedFilename;

      if (generatedPath === expectedPath) {
        console.log(`✅ PASS: ${testCase.name}`);
        console.log(`   Generated: ${generatedPath}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${testCase.name}`);
        console.log(`   Input path: "${testCase.doc.path}"`);
        console.log(`   Expected:   ${expectedPath}`);
        console.log(`   Got:        ${generatedPath}`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
      failed++;
    } finally {
      cleanupTempDir(tmpDir);
    }
  }

  console.log(`\n========================================`);
  console.log(`Whitespace Path Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runTests()
  .then(success => {
    console.log(success ? '🎉 All whitespace path tests passed!' : '❌ Some tests failed.');
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution error:', error);
    process.exit(1);
  });
