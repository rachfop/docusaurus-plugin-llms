/**
 * Test script for path transformation features
 *
 * Run with: node tests/test-path-transformation.js
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
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }

  if (!fs.existsSync(path.join(TEST_DIR, 'docs'))) {
    fs.mkdirSync(path.join(TEST_DIR, 'docs'), { recursive: true });
  }

  if (!fs.existsSync(path.join(TEST_DIR, 'docs', 'api'))) {
    fs.mkdirSync(path.join(TEST_DIR, 'docs', 'api'), { recursive: true });
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Create test markdown files
  fs.writeFileSync(
    path.join(TEST_DIR, 'docs', 'index.md'),
    '---\ntitle: Home\ndescription: Welcome to the test docs.\n---\n\n# Home Page\n\nWelcome to the test docs.',
  );

  fs.writeFileSync(
    path.join(TEST_DIR, 'docs', 'getting-started.md'),
    '---\ntitle: Getting Started\ndescription: This is a getting started guide.\n---\n\n# Getting Started\n\nThis is a getting started guide.',
  );

  fs.writeFileSync(
    path.join(TEST_DIR, 'docs', 'api', 'overview.md'),
    '---\ntitle: API Overview\ndescription: This is the API overview.\n---\n\n# API Overview\n\nThis is the API overview.',
  );
}

// Run the plugin with different configurations
async function runTests() {
  console.log('Running tests...');

  const mockContext = {
    siteDir: TEST_DIR,
    siteConfig: {
      title: 'Test Site',
      tagline: 'Testing docusaurus-plugin-llms',
      url: 'https://example.com',
      baseUrl: '/',
    },
    outDir: OUTPUT_DIR,
  };

  // Test 1: Default behavior (no path transformation)
  console.log('\nTest 1: Default behavior');
  const plugin1 = plugin(mockContext, {
    llmsTxtFilename: 'llms-default.txt',
    llmsFullTxtFilename: 'llms-full-default.txt',
  });
  await plugin1.postBuild();

  // Test 2: Ignore 'docs' path
  console.log('\nTest 2: Ignore "docs" path');
  const plugin2 = plugin(mockContext, {
    pathTransformation: {
      ignorePaths: ['docs'],
    },
    llmsTxtFilename: 'llms-ignore-paths.txt',
    llmsFullTxtFilename: 'llms-full-ignore-paths.txt',
  });
  await plugin2.postBuild();

  // Test 3: Add 'reference' path
  console.log('\nTest 3: Add "reference" path');
  const plugin3 = plugin(mockContext, {
    pathTransformation: {
      addPaths: ['reference'],
    },
    llmsTxtFilename: 'llms-add-paths.txt',
    llmsFullTxtFilename: 'llms-full-add-paths.txt',
  });
  await plugin3.postBuild();

  // Test 4: Both ignore and add paths
  console.log('\nTest 4: Both ignore and add paths');
  const plugin4 = plugin(mockContext, {
    pathTransformation: {
      ignorePaths: ['docs'],
      addPaths: ['reference'],
    },
    llmsTxtFilename: 'llms-combined.txt',
    llmsFullTxtFilename: 'llms-full-combined.txt',
  });
  await plugin4.postBuild();
}

// Verify results
function verifyResults() {
  console.log('\nVerifying results...');

  // Read the generated files
  const defaultFile = fs.readFileSync(path.join(OUTPUT_DIR, 'llms-default.txt'), 'utf8');
  const ignorePathFile = fs.readFileSync(path.join(OUTPUT_DIR, 'llms-ignore-paths.txt'), 'utf8');
  const addPathFile = fs.readFileSync(path.join(OUTPUT_DIR, 'llms-add-paths.txt'), 'utf8');
  const combinedFile = fs.readFileSync(path.join(OUTPUT_DIR, 'llms-combined.txt'), 'utf8');

  // Display link patterns for verification
  console.log('\nDefault file URLs:');
  const defaultUrls = defaultFile.match(/\[.*?\]\((.*?)\)/g);
  defaultUrls?.forEach((url) => console.log(url));

  console.log('\nIgnore Path URLs:');
  const ignoreUrls = ignorePathFile.match(/\[.*?\]\((.*?)\)/g);
  ignoreUrls?.forEach((url) => console.log(url));

  console.log('\nAdd Path URLs:');
  const addUrls = addPathFile.match(/\[.*?\]\((.*?)\)/g);
  addUrls?.forEach((url) => console.log(url));

  console.log('\nCombined Transformation URLs:');
  const combinedUrls = combinedFile.match(/\[.*?\]\((.*?)\)/g);
  combinedUrls?.forEach((url) => console.log(url));

  console.log('\nTest completed. Please verify the URL patterns in the output files.');
}

// Run the tests
async function main() {
  try {
    await setupTestDocs();
    await runTests();
    verifyResults();
    console.log('All tests completed successfully.');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main();
