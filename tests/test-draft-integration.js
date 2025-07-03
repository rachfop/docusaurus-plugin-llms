/**
 * Integration test for draft filtering in generated llms.txt files
 */

const fs = require('fs');
const path = require('path');
const { collectDocFiles, generateLLMFile } = require('../lib/generator');
const { processFilesWithPatterns } = require('../lib/processor');

async function runDraftIntegrationTest() {
  console.log('Running draft filtering integration test...\n');

  // Create test directory structure
  const testDir = path.join(__dirname, 'test-draft-integration');
  const docsDir = path.join(testDir, 'docs');
  const buildDir = path.join(testDir, 'build');
  
  // Clean up and create directories
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir);
  fs.mkdirSync(docsDir);
  fs.mkdirSync(buildDir);

  // Create test files
  const testFiles = [
    {
      path: path.join(docsDir, 'intro.md'),
      content: `---
title: Introduction
---

# Introduction

Welcome to our documentation.`
    },
    {
      path: path.join(docsDir, 'draft-feature.md'),
      content: `---
title: New Feature (Draft)
draft: true
---

# New Feature

This is a draft feature that should not appear in llms.txt.`
    },
    {
      path: path.join(docsDir, 'guide.md'),
      content: `---
title: User Guide
draft: false
---

# User Guide

This is the user guide.`
    },
    {
      path: path.join(docsDir, 'api.md'),
      content: `---
title: API Reference
---

# API Reference

API documentation goes here.`
    },
    {
      path: path.join(docsDir, 'wip.md'),
      content: `---
title: Work in Progress
draft: true
---

# Work in Progress

This page is still being written and should not be published.`
    }
  ];

  // Write test files
  for (const file of testFiles) {
    fs.writeFileSync(file.path, file.content);
  }

  // Mock context
  const mockContext = {
    siteDir: testDir,
    siteUrl: 'https://example.com',
    docsDir: 'docs',
    outDir: buildDir,
    options: {
      docsDir: 'docs',
      outputDir: 'llms'
    }
  };

  try {
    // Collect doc files
    console.log('Collecting documentation files...');
    const allFiles = await collectDocFiles(mockContext);
    console.log(`Found ${allFiles.length} total files`);

    // Process files to get DocInfo objects
    const processedDocs = await processFilesWithPatterns(
      mockContext,
      allFiles,
      [], // includePatterns
      [], // ignorePatterns
      [], // orderPatterns
      true // includeUnmatched
    );
    
    console.log(`Processed ${processedDocs.length} non-draft files`);

    // Generate LLM files
    const outputDir = path.join(buildDir, 'llms');
    fs.mkdirSync(outputDir, { recursive: true });

    // Generate links-only file
    console.log('\nGenerating llms.txt (links only)...');
    await generateLLMFile(
      processedDocs,
      path.join(outputDir, 'llms.txt'),
      'Documentation',
      'Documentation for the project',
      false, // includeContent
      undefined // version
    );

    // Generate full content file
    console.log('Generating llms-full.txt (with content)...');
    await generateLLMFile(
      processedDocs,
      path.join(outputDir, 'llms-full.txt'),
      'Documentation',
      'Documentation for the project',
      true, // includeContent
      undefined // version
    );

    // Read and verify the generated files
    console.log('\nVerifying generated files...');
    
    const llmsTxt = fs.readFileSync(path.join(outputDir, 'llms.txt'), 'utf-8');
    const llmsFullTxt = fs.readFileSync(path.join(outputDir, 'llms-full.txt'), 'utf-8');
    
    // Debug: Show what's in the files
    console.log('\nContent of llms.txt:');
    console.log(llmsTxt.substring(0, 500) + '...');
    console.log('\nTotal processed files:', processedDocs.length);
    console.log('Files:', processedDocs.map(f => f.title));

    // Check that draft pages are not included
    const draftTitles = ['New Feature (Draft)', 'Work in Progress'];
    const publishedTitles = ['Introduction', 'User Guide', 'API Reference'];
    
    let passed = 0;
    let failed = 0;

    // Check links-only file
    console.log('\nChecking llms.txt:');
    for (const draftTitle of draftTitles) {
      if (!llmsTxt.includes(draftTitle)) {
        console.log(`✅ Draft page "${draftTitle}" is not in llms.txt`);
        passed++;
      } else {
        console.log(`❌ Draft page "${draftTitle}" found in llms.txt`);
        failed++;
      }
    }

    for (const publishedTitle of publishedTitles) {
      if (llmsTxt.includes(publishedTitle)) {
        console.log(`✅ Published page "${publishedTitle}" is in llms.txt`);
        passed++;
      } else {
        console.log(`❌ Published page "${publishedTitle}" missing from llms.txt`);
        failed++;
      }
    }

    // Check full content file
    console.log('\nChecking llms-full.txt:');
    for (const draftTitle of draftTitles) {
      if (!llmsFullTxt.includes(draftTitle)) {
        console.log(`✅ Draft page "${draftTitle}" is not in llms-full.txt`);
        passed++;
      } else {
        console.log(`❌ Draft page "${draftTitle}" found in llms-full.txt`);
        failed++;
      }
    }

    // Check that draft content is not included
    if (!llmsFullTxt.includes('This is a draft feature')) {
      console.log(`✅ Draft content is not in llms-full.txt`);
      passed++;
    } else {
      console.log(`❌ Draft content found in llms-full.txt`);
      failed++;
    }

    // Summary
    console.log(`\n========================================`);
    console.log(`Integration Test Summary:`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    console.log(`========================================\n`);

    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }

    return failed === 0;

  } catch (error) {
    console.error('Integration test error:', error);
    // Clean up on error
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
    return false;
  }
}

// Run the test
runDraftIntegrationTest()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });