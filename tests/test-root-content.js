const fs = require('fs').promises;
const path = require('path');
const { generateLLMFile } = require('../lib/generator');

async function setupTestDir() {
  const testDir = path.join(__dirname, 'test-root-content-temp');
  
  // Clean up if exists
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }
  
  await fs.mkdir(testDir, { recursive: true });
  
  return testDir;
}

async function runTests() {
  console.log('Running root content customization tests...\n');
  
  const testDir = await setupTestDir();
  let allTestsPassed = true;
  
  try {
    // Sample document data
    const sampleDocs = [
      {
        title: 'Getting Started',
        path: 'docs/getting-started.md',
        url: 'https://example.com/docs/getting-started',
        content: 'This is the getting started guide.',
        description: 'Learn how to get started'
      },
      {
        title: 'API Reference',
        path: 'docs/api-reference.md',
        url: 'https://example.com/docs/api-reference',
        content: 'This is the API reference.',
        description: 'Complete API documentation'
      }
    ];
    
    // Test 1: Default root content for links file
    console.log('Test 1: Default root content for links file');
    const defaultLinksPath = path.join(testDir, 'llms-default-links.txt');
    await generateLLMFile(
      sampleDocs,
      defaultLinksPath,
      'Test Documentation',
      'Test description',
      false, // links only
      '1.0.0'
    );
    
    const defaultLinksContent = await fs.readFile(defaultLinksPath, 'utf-8');
    if (defaultLinksContent.includes('This file contains links to documentation sections following the llmstxt.org standard.')) {
      console.log('  ✅ PASS: Default root content appears in links file\n');
    } else {
      console.log('  ❌ FAIL: Default root content missing from links file\n');
      allTestsPassed = false;
    }
    
    // Test 2: Custom root content for links file
    console.log('Test 2: Custom root content for links file');
    const customLinksPath = path.join(testDir, 'llms-custom-links.txt');
    const customLinksRootContent = `Welcome to our comprehensive documentation system.

This documentation covers:
- Getting started guides
- API reference materials
- Best practices and tutorials

For questions, visit our support forum at https://example.com/support`;
    
    await generateLLMFile(
      sampleDocs,
      customLinksPath,
      'Test Documentation',
      'Test description',
      false, // links only
      '1.0.0',
      customLinksRootContent
    );
    
    const customLinksContent = await fs.readFile(customLinksPath, 'utf-8');
    if (customLinksContent.includes('Welcome to our comprehensive documentation system')) {
      console.log('  ✅ PASS: Custom root content appears in links file');
    } else {
      console.log('  ❌ FAIL: Custom root content missing from links file');
      allTestsPassed = false;
    }
    
    if (!customLinksContent.includes('This file contains links to documentation sections')) {
      console.log('  ✅ PASS: Default content was replaced');
    } else {
      console.log('  ❌ FAIL: Default content still present');
      allTestsPassed = false;
    }
    console.log('');
    
    // Test 3: Default root content for full content file
    console.log('Test 3: Default root content for full content file');
    const defaultFullPath = path.join(testDir, 'llms-default-full.txt');
    await generateLLMFile(
      sampleDocs,
      defaultFullPath,
      'Test Documentation',
      'Test description',
      true, // full content
      '1.0.0'
    );
    
    const defaultFullContent = await fs.readFile(defaultFullPath, 'utf-8');
    if (defaultFullContent.includes('This file contains all documentation content in a single document following the llmstxt.org standard.')) {
      console.log('  ✅ PASS: Default root content appears in full content file\n');
    } else {
      console.log('  ❌ FAIL: Default root content missing from full content file\n');
      allTestsPassed = false;
    }
    
    // Test 4: Custom root content for full content file
    console.log('Test 4: Custom root content for full content file');
    const customFullPath = path.join(testDir, 'llms-custom-full.txt');
    const customFullRootContent = `Complete documentation bundle for offline AI processing.

Format: Markdown
Last updated: 2024
License: MIT

All content below is organized by topic.`;
    
    await generateLLMFile(
      sampleDocs,
      customFullPath,
      'Test Documentation',
      'Test description',
      true, // full content
      '1.0.0',
      customFullRootContent
    );
    
    const customFullContent = await fs.readFile(customFullPath, 'utf-8');
    if (customFullContent.includes('Complete documentation bundle for offline AI processing')) {
      console.log('  ✅ PASS: Custom root content appears in full content file');
    } else {
      console.log('  ❌ FAIL: Custom root content missing from full content file');
      allTestsPassed = false;
    }
    
    if (!customFullContent.includes('This file contains all documentation content')) {
      console.log('  ✅ PASS: Default content was replaced');
    } else {
      console.log('  ❌ FAIL: Default content still present');
      allTestsPassed = false;
    }
    console.log('');
    
    // Test 5: Markdown formatting in custom root content
    console.log('Test 5: Markdown formatting in custom root content');
    const markdownPath = path.join(testDir, 'llms-markdown.txt');
    const markdownRootContent = `**Important Notice:** This documentation is auto-generated.

### Quick Links
- [GitHub Repository](https://github.com/example/repo)
- [Issue Tracker](https://github.com/example/repo/issues)

> Note: Some features require authentication.`;
    
    await generateLLMFile(
      sampleDocs,
      markdownPath,
      'Test Documentation',
      'Test description',
      false, // links only
      '1.0.0',
      markdownRootContent
    );
    
    const markdownContent = await fs.readFile(markdownPath, 'utf-8');
    if (markdownContent.includes('**Important Notice:**') && 
        markdownContent.includes('### Quick Links') &&
        markdownContent.includes('> Note:')) {
      console.log('  ✅ PASS: Markdown formatting preserved in root content\n');
    } else {
      console.log('  ❌ FAIL: Markdown formatting not preserved\n');
      allTestsPassed = false;
    }
    
  } catch (error) {
    console.error('Test error:', error);
    allTestsPassed = false;
  } finally {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }
  
  // Summary
  if (allTestsPassed) {
    console.log('Results: All root content customization tests passed.');
    console.log('🎉 Root content customization is working correctly!');
  } else {
    console.log('Results: Some tests failed.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});