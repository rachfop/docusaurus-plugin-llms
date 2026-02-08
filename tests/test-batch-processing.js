/**
 * Test batch processing for large document sets
 * Verifies that documents are processed in batches to prevent OOM on large sites
 */

const fs = require('fs/promises');
const path = require('path');
const { generateLLMFile } = require('../lib/generator');

// Test directory setup
const TEST_DIR = path.join(__dirname, 'output-batch-test');

async function setup() {
  // Clean up any existing test directory
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch (err) {
    // Directory doesn't exist, that's fine
  }

  // Create test directory
  await fs.mkdir(TEST_DIR, { recursive: true });
}

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch (err) {
    console.error('Cleanup failed:', err);
  }
}

/**
 * Create a large set of mock documents for testing
 */
function createMockDocuments(count) {
  const docs = [];
  for (let i = 0; i < count; i++) {
    docs.push({
      title: `Document ${i + 1}`,
      path: `/docs/doc-${i + 1}.md`,
      url: `https://example.com/docs/doc-${i + 1}`,
      content: `This is the content of document ${i + 1}.\n\nIt has multiple paragraphs.\n\nAnd some more text to make it realistic.`,
      description: `Description for document ${i + 1}`
    });
  }
  return docs;
}

/**
 * Test 1: Verify batch processing with small batch size
 */
async function testBatchProcessing() {
  console.log('\nTest 1: Batch processing with 250 documents and batch size of 50');

  const docCount = 250;
  const batchSize = 50;
  const docs = createMockDocuments(docCount);
  const outputPath = path.join(TEST_DIR, 'llms-batch-50.txt');

  await generateLLMFile(
    docs,
    outputPath,
    'Test Documentation',
    'Test documentation with batch processing',
    true, // includeFullContent
    '1.0.0',
    undefined,
    batchSize
  );

  // Verify the file was created
  const stats = await fs.stat(outputPath);
  if (!stats.isFile()) {
    throw new Error('Output file was not created');
  }

  // Verify the file contains all documents
  const content = await fs.readFile(outputPath, 'utf-8');

  // Check for presence of first, middle, and last documents
  if (!content.includes('Document 1')) {
    throw new Error('First document not found in output');
  }
  if (!content.includes('Document 125')) {
    throw new Error('Middle document not found in output');
  }
  if (!content.includes('Document 250')) {
    throw new Error('Last document not found in output');
  }

  // Count the number of document headers
  const headerMatches = content.match(/## Document \d+/g);
  if (!headerMatches || headerMatches.length !== docCount) {
    throw new Error(`Expected ${docCount} document headers, found ${headerMatches ? headerMatches.length : 0}`);
  }

  console.log('✓ Successfully processed 250 documents with batch size of 50');
  console.log(`✓ Output file size: ${stats.size} bytes`);
}

/**
 * Test 2: Verify batch processing with single document per batch
 */
async function testSingleDocumentBatch() {
  console.log('\nTest 2: Batch processing with 10 documents and batch size of 1');

  const docCount = 10;
  const batchSize = 1;
  const docs = createMockDocuments(docCount);
  const outputPath = path.join(TEST_DIR, 'llms-batch-1.txt');

  await generateLLMFile(
    docs,
    outputPath,
    'Test Documentation',
    'Test documentation with single document batches',
    true, // includeFullContent
    '1.0.0',
    undefined,
    batchSize
  );

  // Verify the file was created
  const stats = await fs.stat(outputPath);
  if (!stats.isFile()) {
    throw new Error('Output file was not created');
  }

  // Verify the file contains all documents
  const content = await fs.readFile(outputPath, 'utf-8');

  // Count the number of document headers
  const headerMatches = content.match(/## Document \d+/g);
  if (!headerMatches || headerMatches.length !== docCount) {
    throw new Error(`Expected ${docCount} document headers, found ${headerMatches ? headerMatches.length : 0}`);
  }

  console.log('✓ Successfully processed 10 documents with batch size of 1');
}

/**
 * Test 3: Verify batch processing with default batch size
 */
async function testDefaultBatchSize() {
  console.log('\nTest 3: Batch processing with 150 documents and default batch size');

  const docCount = 150;
  const docs = createMockDocuments(docCount);
  const outputPath = path.join(TEST_DIR, 'llms-batch-default.txt');

  // Don't pass batchSize parameter to use default
  await generateLLMFile(
    docs,
    outputPath,
    'Test Documentation',
    'Test documentation with default batch size',
    true, // includeFullContent
    '1.0.0'
  );

  // Verify the file was created
  const stats = await fs.stat(outputPath);
  if (!stats.isFile()) {
    throw new Error('Output file was not created');
  }

  // Verify the file contains all documents
  const content = await fs.readFile(outputPath, 'utf-8');

  // Count the number of document headers
  const headerMatches = content.match(/## Document \d+/g);
  if (!headerMatches || headerMatches.length !== docCount) {
    throw new Error(`Expected ${docCount} document headers, found ${headerMatches ? headerMatches.length : 0}`);
  }

  console.log('✓ Successfully processed 150 documents with default batch size (100)');
}

/**
 * Test 4: Verify batch processing preserves document order
 */
async function testBatchOrderPreservation() {
  console.log('\nTest 4: Verify batch processing preserves document order');

  const docCount = 75;
  const batchSize = 20;
  const docs = createMockDocuments(docCount);
  const outputPath = path.join(TEST_DIR, 'llms-batch-order.txt');

  await generateLLMFile(
    docs,
    outputPath,
    'Test Documentation',
    'Test documentation order preservation',
    true, // includeFullContent
    '1.0.0',
    undefined,
    batchSize
  );

  // Verify the file was created
  const content = await fs.readFile(outputPath, 'utf-8');

  // Extract all document headers in order
  const headerMatches = content.match(/## Document \d+/g);
  if (!headerMatches || headerMatches.length !== docCount) {
    throw new Error(`Expected ${docCount} document headers, found ${headerMatches ? headerMatches.length : 0}`);
  }

  // Verify they are in sequential order
  for (let i = 0; i < headerMatches.length; i++) {
    const expectedHeader = `## Document ${i + 1}`;
    if (headerMatches[i] !== expectedHeader) {
      throw new Error(`Document order mismatch at position ${i}: expected "${expectedHeader}", got "${headerMatches[i]}"`);
    }
  }

  console.log('✓ Document order preserved correctly across batches');
}

/**
 * Test 5: Verify batch processing with links-only mode
 */
async function testBatchProcessingLinksOnly() {
  console.log('\nTest 5: Batch processing with links-only mode');

  const docCount = 100;
  const batchSize = 25;
  const docs = createMockDocuments(docCount);
  const outputPath = path.join(TEST_DIR, 'llms-batch-links.txt');

  await generateLLMFile(
    docs,
    outputPath,
    'Test Documentation',
    'Test documentation links only',
    false, // links only, no full content
    '1.0.0',
    undefined,
    batchSize
  );

  // Verify the file was created
  const stats = await fs.stat(outputPath);
  if (!stats.isFile()) {
    throw new Error('Output file was not created');
  }

  // Verify the file contains links (not affected by batch processing, but should still work)
  const content = await fs.readFile(outputPath, 'utf-8');

  // Links-only files should have markdown links
  const linkMatches = content.match(/\[Document \d+\]\(https:\/\/example\.com\/docs\/doc-\d+\)/g);
  if (!linkMatches || linkMatches.length !== docCount) {
    throw new Error(`Expected ${docCount} links, found ${linkMatches ? linkMatches.length : 0}`);
  }

  // File should be smaller than full content version
  if (stats.size > 10000) { // Should be much smaller without full content
    console.warn(`Warning: Links-only file seems larger than expected (${stats.size} bytes)`);
  }

  console.log('✓ Links-only mode works correctly with batch processing parameter');
}

// Run all tests
async function runTests() {
  console.log('Starting batch processing tests...');

  try {
    await setup();

    await testBatchProcessing();
    await testSingleDocumentBatch();
    await testDefaultBatchSize();
    await testBatchOrderPreservation();
    await testBatchProcessingLinksOnly();

    await cleanup();

    console.log('\n✓ All batch processing tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    await cleanup();
    process.exit(1);
  }
}

runTests();
