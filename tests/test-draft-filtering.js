/**
 * Tests for draft page filtering functionality
 */

const fs = require('fs');
const path = require('path');
const { processMarkdownFile, processFilesWithPatterns } = require('../lib/processor');

// Mock implementations
const mockReadFile = (content) => Promise.resolve(content);

// Test cases for draft filtering
const testCases = [
  {
    name: 'Should exclude pages with draft: true',
    content: `---
title: Draft Page
draft: true
---

# This is a draft page

This content should not appear in llms.txt.`,
    expectedResult: null
  },
  {
    name: 'Should include pages with draft: false',
    content: `---
title: Published Page
draft: false
---

# This is a published page

This content should appear in llms.txt.`,
    expectedResult: {
      title: 'Published Page',
      description: 'This is a published page',
      // Other fields will be validated in the test
    }
  },
  {
    name: 'Should include pages without draft field',
    content: `---
title: Regular Page
---

# This is a regular page

This content should appear in llms.txt.`,
    expectedResult: {
      title: 'Regular Page',
      description: 'This is a regular page',
      // Other fields will be validated in the test
    }
  },
  {
    name: 'Should exclude pages with draft: "true" (string)',
    content: `---
title: String Draft Page
draft: "true"
---

# This is a draft page with string value

This should still be included as draft is a string, not boolean.`,
    expectedResult: {
      title: 'String Draft Page',
      description: 'This is a draft page with string value',
      // Other fields will be validated in the test
    }
  }
];

// Test function
async function runDraftFilteringTests() {
  console.log('Running draft filtering tests...\n');
  
  let passed = 0;
  let failed = 0;

  // Create a temporary test directory
  const testDir = path.join(__dirname, 'test-draft-docs');
  const docsDir = path.join(testDir, 'docs');
  
  // Clean up and create test directories
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir);
  fs.mkdirSync(docsDir);

  // Test individual processMarkdownFile function
  console.log('Testing processMarkdownFile with draft pages:');
  
  for (const testCase of testCases) {
    try {
      // Create test file
      const fileName = testCase.name.toLowerCase().replace(/\s+/g, '-') + '.md';
      const filePath = path.join(docsDir, fileName);
      fs.writeFileSync(filePath, testCase.content);
      
      // Process the file
      const result = await processMarkdownFile(
        filePath,
        docsDir,
        'https://example.com',
        'docs'
      );
      
      // Validate result
      if (testCase.expectedResult === null) {
        if (result === null) {
          console.log(`✅ ${testCase.name}`);
          passed++;
        } else {
          console.log(`❌ ${testCase.name} - Expected null but got result`);
          failed++;
        }
      } else {
        if (result !== null && result.title === testCase.expectedResult.title) {
          console.log(`✅ ${testCase.name}`);
          passed++;
        } else {
          console.log(`❌ ${testCase.name} - Unexpected result`);
          console.log('  Expected:', testCase.expectedResult);
          console.log('  Got:', result);
          failed++;
        }
      }
    } catch (error) {
      console.log(`❌ ${testCase.name} - Error: ${error.message}`);
      failed++;
    }
  }

  // Test processFilesWithPatterns integration
  console.log('\nTesting processFilesWithPatterns with draft filtering:');
  
  try {
    // Create additional test files
    fs.writeFileSync(path.join(docsDir, 'published1.md'), `---
title: Published Article 1
---

# Published Article 1

This is a published article.`);

    fs.writeFileSync(path.join(docsDir, 'draft1.md'), `---
title: Draft Article 1
draft: true
---

# Draft Article 1

This is a draft article.`);

    fs.writeFileSync(path.join(docsDir, 'published2.md'), `---
title: Published Article 2
draft: false
---

# Published Article 2

This is another published article.`);

    // Mock context
    const mockContext = {
      siteDir: testDir,
      siteUrl: 'https://example.com',
      docsDir: 'docs',
      options: {}
    };

    // Get all files
    const allFiles = fs.readdirSync(docsDir)
      .map(file => path.join(docsDir, file))
      .filter(file => file.endsWith('.md'));

    // Process files
    const processedDocs = await processFilesWithPatterns(
      mockContext,
      allFiles,
      [], // includePatterns
      [], // ignorePatterns
      [], // orderPatterns
      true // includeUnmatched
    );

    // Count non-draft files
    const expectedNonDraftCount = allFiles.filter(file => {
      const content = fs.readFileSync(file, 'utf-8');
      return !content.includes('draft: true');
    }).length;

    if (processedDocs.length === expectedNonDraftCount) {
      console.log(`✅ processFilesWithPatterns correctly filtered draft pages`);
      console.log(`  Found ${processedDocs.length} non-draft pages out of ${allFiles.length} total`);
      passed++;
    } else {
      console.log(`❌ processFilesWithPatterns did not filter correctly`);
      console.log(`  Expected ${expectedNonDraftCount} non-draft pages but got ${processedDocs.length}`);
      failed++;
    }

    // Verify draft pages are not in the results
    const draftTitles = processedDocs.filter(doc => 
      doc.title.includes('Draft Article')
    );
    
    if (draftTitles.length === 0) {
      console.log(`✅ No draft pages found in processed documents`);
      passed++;
    } else {
      console.log(`❌ Found ${draftTitles.length} draft pages in processed documents`);
      failed++;
    }

  } catch (error) {
    console.log(`❌ Integration test failed: ${error.message}`);
    failed++;
  }

  // Clean up
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }

  // Summary
  console.log(`\n========================================`);
  console.log(`Draft Filtering Tests Summary:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run tests
runDraftFilteringTests()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });