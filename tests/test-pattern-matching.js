/**
 * Test script for pattern matching fix (Issue #25)
 * Tests that includeOrder patterns match against both site-relative and docs-relative paths
 *
 * Run with: node tests/test-pattern-matching.js
 */

const fs = require('fs');
const path = require('path');
const pluginModule = require('../lib/index');
const plugin = pluginModule.default;

// Create test directory structure
const TEST_DIR = path.join(__dirname, '..', 'test-docs');
const OUTPUT_DIR = path.join(__dirname, '..', 'test-output');

// Setup test docs structure
async function setupTestDocs() {
  console.log('Setting up test docs...');

  // Create directories
  const dirs = [
    TEST_DIR,
    path.join(TEST_DIR, 'docs'),
    path.join(TEST_DIR, 'docs', 'quickstart'),
    path.join(TEST_DIR, 'docs', 'guides'),
    path.join(TEST_DIR, 'docs', 'guides', 'advanced'),
    path.join(TEST_DIR, 'docs', 'api'),
    path.join(TEST_DIR, 'docs', 'tutorials'),
    path.join(TEST_DIR, 'docs', 'tutorials', 'beginner'),
    OUTPUT_DIR,
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Create test markdown files
  const files = [
    {
      path: path.join(TEST_DIR, 'docs', 'index.md'),
      content: '---\ntitle: Home\ndescription: Welcome page\n---\n\n# Home\n\nWelcome.'
    },
    {
      path: path.join(TEST_DIR, 'docs', 'quickstart', 'installation.md'),
      content: '---\ntitle: Installation\ndescription: Quick installation guide\n---\n\n# Installation\n\nInstall the package.'
    },
    {
      path: path.join(TEST_DIR, 'docs', 'quickstart', 'setup.md'),
      content: '---\ntitle: Setup\ndescription: Setup guide\n---\n\n# Setup\n\nConfigure your environment.'
    },
    {
      path: path.join(TEST_DIR, 'docs', 'guides', 'basic.md'),
      content: '---\ntitle: Basic Guide\ndescription: Basic usage guide\n---\n\n# Basic Guide\n\nBasic usage.'
    },
    {
      path: path.join(TEST_DIR, 'docs', 'guides', 'advanced', 'performance.md'),
      content: '---\ntitle: Performance\ndescription: Performance optimization\n---\n\n# Performance\n\nOptimize performance.'
    },
    {
      path: path.join(TEST_DIR, 'docs', 'api', 'core.md'),
      content: '---\ntitle: Core API\ndescription: Core API reference\n---\n\n# Core API\n\nCore API documentation.'
    },
    {
      path: path.join(TEST_DIR, 'docs', 'tutorials', 'first-app.md'),
      content: '---\ntitle: First App\ndescription: Build your first app\n---\n\n# First App\n\nBuild your first application.'
    },
    {
      path: path.join(TEST_DIR, 'docs', 'tutorials', 'beginner', 'hello-world.md'),
      content: '---\ntitle: Hello World\ndescription: Hello world tutorial\n---\n\n# Hello World\n\nCreate a hello world app.'
    },
  ];

  files.forEach(file => {
    fs.writeFileSync(file.path, file.content);
  });

  console.log('Test docs setup complete.');
}

// Run the plugin with different pattern matching tests
async function runTests() {
  console.log('\n========================================');
  console.log('Running Pattern Matching Tests');
  console.log('========================================\n');

  const mockContext = {
    siteDir: TEST_DIR,
    siteConfig: {
      title: 'Pattern Matching Test',
      tagline: 'Testing pattern matching behavior',
      url: 'https://example.com',
      baseUrl: '/',
    },
    outDir: OUTPUT_DIR,
  };

  // Test 1: Docs-relative pattern (without "docs/" prefix)
  console.log('Test 1: Docs-relative pattern "quickstart/*"');
  console.log('Expected: Should match docs/quickstart/*.md files\n');
  const plugin1 = plugin(mockContext, {
    includeOrder: [
      'quickstart/*',
    ],
    includeUnmatchedLast: false,
    llmsTxtFilename: 'llms-test1.txt',
    llmsFullTxtFilename: 'llms-full-test1.txt'
  });
  await plugin1.postBuild();

  // Test 2: Site-relative pattern (with "docs/" prefix)
  console.log('Test 2: Site-relative pattern "docs/quickstart/*"');
  console.log('Expected: Should match docs/quickstart/*.md files\n');
  const plugin2 = plugin(mockContext, {
    includeOrder: [
      'docs/quickstart/*',
    ],
    includeUnmatchedLast: false,
    llmsTxtFilename: 'llms-test2.txt',
    llmsFullTxtFilename: 'llms-full-test2.txt'
  });
  await plugin2.postBuild();

  // Test 3: Nested directory pattern (docs-relative)
  console.log('Test 3: Nested pattern "guides/**/*"');
  console.log('Expected: Should match all files in guides directory (including nested subdirectories)\n');
  const plugin3 = plugin(mockContext, {
    includeOrder: [
      'guides/**/*',
    ],
    includeUnmatchedLast: false,
    llmsTxtFilename: 'llms-test3.txt',
    llmsFullTxtFilename: 'llms-full-test3.txt'
  });
  await plugin3.postBuild();

  // Test 4: Multiple patterns in order (docs-relative)
  console.log('Test 4: Ordered patterns ["quickstart/*", "guides/*", "api/*"]');
  console.log('Expected: Files should appear in this order\n');
  const plugin4 = plugin(mockContext, {
    includeOrder: [
      'quickstart/*',
      'guides/*',
      'api/*',
    ],
    includeUnmatchedLast: true,
    llmsTxtFilename: 'llms-test4.txt',
    llmsFullTxtFilename: 'llms-full-test4.txt'
  });
  await plugin4.postBuild();

  // Test 5: Deep nested pattern
  console.log('Test 5: Deep nested pattern "tutorials/**/*"');
  console.log('Expected: Should match all files in tutorials directory and subdirectories\n');
  const plugin5 = plugin(mockContext, {
    includeOrder: [
      'tutorials/**/*',
    ],
    includeUnmatchedLast: false,
    llmsTxtFilename: 'llms-test5.txt',
    llmsFullTxtFilename: 'llms-full-test5.txt'
  });
  await plugin5.postBuild();

  // Test 6: Specific file pattern (docs-relative)
  console.log('Test 6: Specific file pattern "quickstart/installation.md"');
  console.log('Expected: Should match only the installation file\n');
  const plugin6 = plugin(mockContext, {
    includeOrder: [
      'quickstart/installation.md',
    ],
    includeUnmatchedLast: false,
    llmsTxtFilename: 'llms-test6.txt',
    llmsFullTxtFilename: 'llms-full-test6.txt'
  });
  await plugin6.postBuild();

  // Test 7: Mixed patterns (both site-relative and docs-relative)
  console.log('Test 7: Mixed patterns ["docs/quickstart/*", "guides/*"]');
  console.log('Expected: Should match both patterns correctly\n');
  const plugin7 = plugin(mockContext, {
    includeOrder: [
      'docs/quickstart/*',
      'guides/*',
    ],
    includeUnmatchedLast: true,
    llmsTxtFilename: 'llms-test7.txt',
    llmsFullTxtFilename: 'llms-full-test7.txt'
  });
  await plugin7.postBuild();

  // Test 8: Ignore pattern (docs-relative)
  console.log('Test 8: Ignore pattern "guides/**/*"');
  console.log('Expected: Should exclude all files in guides directory\n');
  const plugin8 = plugin(mockContext, {
    ignoreFiles: ['guides/**/*'],
    llmsTxtFilename: 'llms-test8.txt',
    llmsFullTxtFilename: 'llms-full-test8.txt'
  });
  await plugin8.postBuild();
}

// Verify results
function verifyResults() {
  console.log('\n========================================');
  console.log('Verification Results');
  console.log('========================================\n');

  const tests = [
    {
      name: 'Test 1 (quickstart/*)',
      file: 'llms-test1.txt',
      expectedIncludes: ['Installation', 'Setup'],
      expectedExcludes: ['Basic Guide', 'Core API', 'First App']
    },
    {
      name: 'Test 2 (docs/quickstart/*)',
      file: 'llms-test2.txt',
      expectedIncludes: ['Installation', 'Setup'],
      expectedExcludes: ['Basic Guide', 'Core API', 'First App']
    },
    {
      name: 'Test 3 (guides/**/*)',
      file: 'llms-test3.txt',
      expectedIncludes: ['Basic Guide', 'Performance'],
      expectedExcludes: ['Installation', 'Core API', 'First App']
    },
    {
      name: 'Test 4 (ordered patterns)',
      file: 'llms-test4.txt',
      expectedIncludes: ['Installation', 'Setup', 'Basic Guide', 'Core API'],
      expectedExcludes: []
    },
    {
      name: 'Test 5 (tutorials/**/*)',
      file: 'llms-test5.txt',
      expectedIncludes: ['First App', 'Hello World'],
      expectedExcludes: ['Installation', 'Basic Guide', 'Core API']
    },
    {
      name: 'Test 6 (specific file)',
      file: 'llms-test6.txt',
      expectedIncludes: ['Installation'],
      expectedExcludes: ['Setup', 'Basic Guide', 'Core API']
    },
    {
      name: 'Test 7 (mixed patterns)',
      file: 'llms-test7.txt',
      expectedIncludes: ['Installation', 'Setup', 'Basic Guide', 'Performance'],
      expectedExcludes: []
    },
    {
      name: 'Test 8 (ignore pattern)',
      file: 'llms-test8.txt',
      expectedIncludes: ['Installation', 'Core API'],
      expectedExcludes: ['Basic Guide', 'Performance']
    },
  ];

  let passedTests = 0;
  let failedTests = 0;

  tests.forEach(test => {
    const filePath = path.join(OUTPUT_DIR, test.file);
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${test.name}: File not found`);
      failedTests++;
      return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    let passed = true;
    const issues = [];

    // Check expected includes
    test.expectedIncludes.forEach(expected => {
      if (!content.includes(expected)) {
        passed = false;
        issues.push(`Missing: "${expected}"`);
      }
    });

    // Check expected excludes
    test.expectedExcludes.forEach(expected => {
      if (content.includes(expected)) {
        passed = false;
        issues.push(`Should not include: "${expected}"`);
      }
    });

    if (passed) {
      console.log(`✅ ${test.name}: PASSED`);
      passedTests++;
    } else {
      console.log(`❌ ${test.name}: FAILED`);
      issues.forEach(issue => console.log(`   - ${issue}`));
      failedTests++;
    }
  });

  console.log('\n========================================');
  console.log(`Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('========================================\n');

  return failedTests === 0;
}

// Clean up test files
function cleanup() {
  console.log('Cleaning up test files...');
  // Uncomment to remove test files after running
  // fs.rmSync(TEST_DIR, { recursive: true, force: true });
  // fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
}

// Run the tests
async function main() {
  try {
    await setupTestDocs();
    await runTests();
    const success = verifyResults();
    // cleanup();

    if (success) {
      console.log('✅ All pattern matching tests passed successfully!');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed. Please review the output above.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
  }
}

main();
