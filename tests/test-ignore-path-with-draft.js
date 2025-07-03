/**
 * Test script for ignore path functionality with draft files
 * 
 * Run with: node tests/test-ignore-path-with-draft.js
 */

const fs = require('fs');
const path = require('path');
const { processMarkdownFile, processFilesWithPatterns } = require('../lib/processor');
const { readMarkdownFiles } = require('../lib/utils');

// Create test directory structure
const TEST_DIR = path.join(__dirname, '..', 'test-ignore-docs');

// Setup test docs structure
async function setupTestDocs() {
  console.log('Setting up test docs...');
  
  // Create directories
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
  
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'docs', 'tutorials'), { recursive: true });
  
  // Create test markdown files
  fs.writeFileSync(
    path.join(TEST_DIR, 'docs', 'index.md'),
    '---\ntitle: Home\n---\n\n# Home Page\n\nWelcome to the test docs.'
  );
  
  fs.writeFileSync(
    path.join(TEST_DIR, 'docs', 'tutorials', 'getting-started.md'),
    '---\ntitle: Getting Started\n---\n\n# Getting Started\n\nThis is a getting started guide.'
  );
  
  // Create the draft file
  fs.writeFileSync(
    path.join(TEST_DIR, 'docs', 'tutorials', 'draft.md'),
    '---\ntitle: Draft Tutorial\ndraft: true\n---\n\n# Draft Tutorial\n\nThis is a draft tutorial.'
  );
  
  // Create another regular file in tutorials
  fs.writeFileSync(
    path.join(TEST_DIR, 'docs', 'tutorials', 'advanced.md'),
    '---\ntitle: Advanced Tutorial\n---\n\n# Advanced Tutorial\n\nThis is an advanced tutorial.'
  );
}

// Test 1: Test readMarkdownFiles with ignore patterns
async function testReadMarkdownFilesIgnore() {
  console.log('\n=== Test 1: readMarkdownFiles with ignore patterns ===');
  
  const docsDir = path.join(TEST_DIR, 'docs');
  
  // Test without ignore patterns
  console.log('\nReading all files (no ignore patterns):');
  const allFiles = await readMarkdownFiles(docsDir, docsDir, []);
  console.log(`Found ${allFiles.length} files:`);
  allFiles.forEach(file => {
    const relativePath = path.relative(docsDir, file);
    console.log(`  - ${relativePath}`);
  });
  
  // Test with ignore pattern for draft.md
  console.log('\nReading files with ignore pattern "**/draft.md":');
  const filesWithoutDraft = await readMarkdownFiles(docsDir, docsDir, ['**/draft.md']);
  console.log(`Found ${filesWithoutDraft.length} files:`);
  filesWithoutDraft.forEach(file => {
    const relativePath = path.relative(docsDir, file);
    console.log(`  - ${relativePath}`);
  });
  
  // Test with ignore pattern for entire tutorials directory
  console.log('\nReading files with ignore pattern "tutorials/**":');
  const filesWithoutTutorials = await readMarkdownFiles(docsDir, docsDir, ['tutorials/**']);
  console.log(`Found ${filesWithoutTutorials.length} files:`);
  filesWithoutTutorials.forEach(file => {
    const relativePath = path.relative(docsDir, file);
    console.log(`  - ${relativePath}`);
  });
  
  // Verify results
  const hasDraftInFirst = allFiles.some(f => f.includes('draft.md'));
  const hasDraftInSecond = filesWithoutDraft.some(f => f.includes('draft.md'));
  const hasTutorialsInThird = filesWithoutTutorials.some(f => f.includes('tutorials'));
  
  console.log('\nVerification:');
  console.log(`✅ All files includes draft.md: ${hasDraftInFirst}`);
  console.log(`✅ Ignored pattern excludes draft.md: ${!hasDraftInSecond}`);
  console.log(`✅ Ignored pattern excludes tutorials dir: ${!hasTutorialsInThird}`);
  
  return !hasDraftInSecond && !hasTutorialsInThird;
}

// Test 2: Test processFilesWithPatterns with ignore patterns
async function testProcessFilesWithPatternsIgnore() {
  console.log('\n=== Test 2: processFilesWithPatterns with ignore patterns ===');
  
  const mockContext = {
    siteDir: TEST_DIR,
    siteUrl: 'https://example.com',
    docsDir: 'docs',
    options: {}
  };
  
  const docsDir = path.join(TEST_DIR, 'docs');
  const allFiles = await readMarkdownFiles(docsDir, docsDir, []);
  
  // Test without ignore patterns
  console.log('\nProcessing all files (no ignore patterns):');
  const allProcessed = await processFilesWithPatterns(
    mockContext,
    allFiles,
    [], // includePatterns
    [], // ignorePatterns
    [], // orderPatterns
    true // includeUnmatched
  );
  
  console.log(`Processed ${allProcessed.length} files:`);
  allProcessed.forEach(doc => {
    console.log(`  - ${doc.title} (${doc.path}) - Draft: ${doc.title.includes('Draft')}`);
  });
  
  // Note: Draft filtering happens in processMarkdownFile, not in processFilesWithPatterns ignore
  // The ignorePatterns parameter filters files before processing
  
  // Test with ignore pattern
  console.log('\nProcessing with ignore pattern "**/draft.md":');
  const withIgnorePattern = await processFilesWithPatterns(
    mockContext,
    allFiles,
    [], // includePatterns
    ['**/draft.md'], // ignorePatterns
    [], // orderPatterns
    true // includeUnmatched
  );
  
  console.log(`Processed ${withIgnorePattern.length} files:`);
  withIgnorePattern.forEach(doc => {
    console.log(`  - ${doc.title} (${doc.path})`);
  });
  
  // Verify results
  const hasDraftInProcessed = withIgnorePattern.some(doc => doc.path.includes('draft.md'));
  console.log(`\n✅ Ignore pattern excludes draft.md from processing: ${!hasDraftInProcessed}`);
  
  return !hasDraftInProcessed;
}

// Test 3: Test draft filtering vs ignore patterns
async function testDraftFilteringVsIgnorePatterns() {
  console.log('\n=== Test 3: Draft filtering vs Ignore patterns ===');
  console.log('This test shows the difference between draft: true filtering and ignore patterns');
  
  const mockContext = {
    siteDir: TEST_DIR,
    siteUrl: 'https://example.com',
    docsDir: 'docs',
    options: {}
  };
  
  // Create a non-draft file that matches draft pattern
  fs.writeFileSync(
    path.join(TEST_DIR, 'docs', 'tutorials', 'draft-naming.md'),
    '---\ntitle: Draft Naming Convention\n---\n\n# Draft Naming Convention\n\nThis file has "draft" in its name but is not a draft.'
  );
  
  const docsDir = path.join(TEST_DIR, 'docs');
  const allFiles = await readMarkdownFiles(docsDir, docsDir, []);
  
  // Process without any filtering
  console.log('\n1. No filtering:');
  const noFiltering = await processFilesWithPatterns(mockContext, allFiles, [], [], [], true);
  console.log(`Found ${noFiltering.length} files (draft: true files are excluded by processMarkdownFile)`);
  noFiltering.forEach(doc => {
    console.log(`  - ${doc.title} (${doc.path})`);
  });
  
  // Process with ignore pattern
  console.log('\n2. With ignore pattern "**/draft*.md":');
  const withIgnore = await processFilesWithPatterns(
    mockContext,
    allFiles,
    [],
    ['**/draft*.md'], // This will exclude files with "draft" in the name
    [],
    true
  );
  console.log(`Found ${withIgnore.length} files`);
  withIgnore.forEach(doc => {
    console.log(`  - ${doc.title} (${doc.path})`);
  });
  
  console.log('\nKey differences:');
  console.log('- draft: true filtering happens during markdown processing (content-based)');
  console.log('- ignore patterns filter files before processing (path-based)');
  console.log('- ignore patterns can exclude files regardless of their draft status');
  
  return true;
}

// Run all tests
async function main() {
  try {
    await setupTestDocs();
    
    const test1Success = await testReadMarkdownFilesIgnore();
    const test2Success = await testProcessFilesWithPatternsIgnore();
    const test3Success = await testDraftFilteringVsIgnorePatterns();
    
    console.log('\n========================================');
    console.log('Test Summary:');
    console.log(`Test 1 (readMarkdownFiles): ${test1Success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 2 (processFilesWithPatterns): ${test2Success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Test 3 (Draft vs Ignore): ${test3Success ? '✅ PASSED' : '❌ FAILED'}`);
    console.log('========================================');
    
    // Clean up
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    
    const allPassed = test1Success && test2Success && test3Success;
    if (!allPassed) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

main();