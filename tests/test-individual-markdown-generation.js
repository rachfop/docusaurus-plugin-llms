/**
 * Tests for individual markdown file generation functionality
 * 
 * Run with: node test-individual-markdown-generation.js
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

// Test cases for individual markdown file generation
const testCases = [
  {
    name: 'Basic markdown file generation with path preservation',
    docs: [
      {
        title: 'Getting Started',
        path: 'docs/getting-started.md',
        content: 'This is the getting started guide.\n\nFollow these steps to begin.',
        description: 'Introduction to the system',
        url: 'https://example.com/docs/getting-started'
      }
    ],
    expectedPaths: ['getting-started.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Nested directory structure preservation',
    docs: [
      {
        title: 'API Reference: v2.0 (Beta)',
        path: 'docs/api/reference.md',
        content: 'This is the API reference documentation.\n\nVersion 2.0 beta features.',
        description: 'API reference documentation for version 2.0',
        url: 'https://example.com/docs/api/reference'
      }
    ],
    expectedPaths: ['api/reference.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Duplicate paths handling',
    docs: [
      {
        title: 'Configuration',
        path: 'docs/basic/configuration.md',
        content: 'Basic configuration options.\n\nThese are the basic settings.',
        description: 'Basic configuration guide',
        url: 'https://example.com/docs/basic/configuration'
      },
      {
        title: 'Different Configuration',
        path: 'docs/basic/configuration.md', // Same path, different content
        content: 'Different configuration options.\n\nThese are different settings.',
        description: 'Different configuration guide',
        url: 'https://example.com/docs/basic/configuration'
      }
    ],
    expectedPaths: ['basic/configuration.md', 'basic/configuration-2.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Empty path fallback to title',
    docs: [
      {
        title: 'Troubleshooting Guide',
        path: '',
        content: 'This is a troubleshooting guide.\n\nCommon issues and solutions.',
        description: 'How to troubleshoot common issues',
        url: 'https://example.com/troubleshooting'
      }
    ],
    expectedPaths: ['troubleshooting-guide.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Mixed directory structures',
    docs: [
      {
        title: 'Quick Start',
        path: 'docs/quick-start.md',
        content: 'Get started quickly with our platform.\n\nJust a few simple steps.',
        description: 'Quick start guide for new users',
        url: 'https://example.com/docs/quick-start'
      },
      {
        title: 'Tutorial #1',
        path: 'docs/tutorials/tutorial-1.md',
        content: 'First tutorial in our series.\n\nLearn the basics here.',
        description: 'Basic tutorial for beginners',
        url: 'https://example.com/docs/tutorials/tutorial-1'
      },
      {
        title: 'Tutorial #2',
        path: 'guides/advanced/tutorial-2.md',
        content: 'Second tutorial building on the first.\n\nAdvanced concepts covered.',
        description: 'Advanced tutorial building on basics',
        url: 'https://example.com/guides/advanced/tutorial-2'
      }
    ],
    expectedPaths: ['quick-start.md', 'tutorials/tutorial-1.md', 'guides/advanced/tutorial-2.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Deep nested structure with extension normalization',
    docs: [
      {
        title: 'Deep Nested Document',
        path: 'docs/level1/level2/level3/document.mdx',
        content: 'Content in a deeply nested structure.\n\nThis tests deep directory creation.',
        description: 'Testing deep nested paths',
        url: 'https://example.com/docs/level1/level2/level3/document'
      }
    ],
    expectedPaths: ['level1/level2/level3/document.md'], // .mdx becomes .md
    siteUrl: 'https://example.com'
  }
];

async function runIndividualMarkdownGenerationTests() {
  console.log('Running individual markdown file generation tests...\n');
  
  let passed = 0;
  let failed = 0;

  // Create a temporary test directory
  const testDir = path.join(__dirname, 'test-markdown-generation');
  
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
          'docs', // Use 'docs' as the default for tests
          [], // No frontmatter preservation for basic tests
          false // Don't preserve directory structure (old behavior for these tests)
        );
        
        // Check that the expected files were created at the correct paths
        let pathsCorrect = true;
        const createdFiles = [];
        
        for (let i = 0; i < testCase.expectedPaths.length; i++) {
          const expectedPath = testCase.expectedPaths[i];
          const fullPath = path.join(testDir, expectedPath);
          
          if (!fs.existsSync(fullPath)) {
            console.log(`❌ FAIL - Expected file at path "${expectedPath}" not found`);
            pathsCorrect = false;
            break;
          }
          
          createdFiles.push(expectedPath);
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
          const expectedPath = testCase.expectedPaths[i];
          const expectedUrl = `${testCase.siteUrl}/${expectedPath}`;
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
        
        // Check file contents
        let contentsCorrect = true;
        for (let i = 0; i < testCase.expectedPaths.length; i++) {
          const expectedPath = testCase.expectedPaths[i];
          const filepath = path.join(testDir, expectedPath);
          
          if (!fs.existsSync(filepath)) {
            console.log(`❌ FAIL - Generated file "${expectedPath}" does not exist`);
            contentsCorrect = false;
            break;
          }
          
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
        
        if (!contentsCorrect) {
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
        
        if (docPathsCorrect) {
          console.log(`✅ PASS`);
          passed++;
        } else {
          failed++;
        }
        
        // Clean up for next test
        await cleanupTestDirectory(testDir);
        
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        failed++;
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
  console.log(`Individual Markdown Generation Tests Summary:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Test edge cases
async function testEdgeCases() {
  console.log('Running edge case tests...\n');
  
  let passed = 0;
  let failed = 0;

  const testDir = path.join(__dirname, 'test-edge-cases');
  
  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const edgeCases = [
    {
      name: 'Empty docs array',
      docs: [],
      expectedPaths: []
    },
    {
      name: 'Doc with no description',
      docs: [
        {
          title: 'No Description',
          path: 'docs/no-desc.md',
          content: 'Content without description',
          description: '',
          url: 'https://example.com/docs/no-desc'
        }
      ],
      expectedPaths: ['no-desc.md']
    },
    {
      name: 'Doc with special characters in path',
      docs: [
        {
          title: 'Special Path',
          path: 'docs/special-chars/file.with.dots.md',
          content: 'Content with special path',
          description: 'Testing special characters',
          url: 'https://example.com/docs/special'
        }
      ],
      expectedPaths: ['special-chars/file.with.dots.md']
    }
  ];

  try {
    for (const testCase of edgeCases) {
      console.log(`Edge Case Test: ${testCase.name}`);
      
      try {
        const result = await generateIndividualMarkdownFiles(
          testCase.docs,
          testDir,
          'https://example.com',
          'docs', // Use 'docs' as the default for tests
          [], // No frontmatter preservation for edge case tests
          false // Don't preserve directory structure (old behavior for these tests)
        );
        
        // Check that all expected paths exist
        let allPathsExist = true;
        for (const expectedPath of testCase.expectedPaths) {
          const fullPath = path.join(testDir, expectedPath);
          if (!fs.existsSync(fullPath)) {
            console.log(`❌ FAIL - Expected path "${expectedPath}" not found`);
            allPathsExist = false;
            break;
          }
        }
        
        if (allPathsExist && result.length === testCase.expectedPaths.length) {
          console.log(`✅ PASS`);
          passed++;
        } else {
          console.log(`❌ FAIL - Expected ${testCase.expectedPaths.length} files, got ${result.length}`);
          failed++;
        }
        
        // Clean up for next test
        await cleanupTestDirectory(testDir);
        
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        failed++;
      }
    }
  } finally {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }

  console.log(`\nEdge Case Results: ${passed} of ${edgeCases.length} tests passed.`);
  return failed === 0;
}

// Test keepFrontMatter functionality
async function testKeepFrontMatter() {
  console.log('Running keepFrontMatter tests...\n');
  
  let passed = 0;
  let failed = 0;

  const testDir = path.join(__dirname, 'test-frontmatter');
  
  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  const frontmatterTestCases = [
    {
      name: 'No frontmatter preservation (empty array)',
      docs: [
        {
          title: 'Test Document',
          path: 'docs/test.md',
          content: 'Test content here.',
          description: 'Test description',
          url: 'https://example.com/test',
          frontMatter: {
            sidebar_label: 'Custom Label',
            keywords: ['test', 'frontmatter'],
            author: 'Test Author'
          }
        }
      ],
      keepFrontMatter: [],
      expectedFrontmatter: {},
      expectedPaths: ['test.md']
    },
    {
      name: 'Basic frontmatter preservation',
      docs: [
        {
          title: 'API Guide',
          path: 'docs/api-guide.md',
          content: 'API documentation content.',
          description: 'Complete API guide',
          url: 'https://example.com/api-guide',
          frontMatter: {
            sidebar_label: 'API Reference',
            keywords: ['api', 'reference', 'documentation'],
            tags: ['guide', 'api'],
            author: 'API Team',
            draft: false,
            custom_field: 'custom_value'
          }
        }
      ],
      keepFrontMatter: ['sidebar_label', 'keywords', 'tags'],
      expectedFrontmatter: {
        sidebar_label: 'API Reference',
        keywords: ['api', 'reference', 'documentation'],
        tags: ['guide', 'api']
      },
      expectedPaths: ['api-guide.md']
    },
    {
      name: 'All frontmatter fields preserved',
      docs: [
        {
          title: 'Complete Guide',
          path: 'docs/complete-guide.md',
          content: 'Complete guide content.',
          description: 'A complete guide to everything',
          url: 'https://example.com/complete-guide',
          frontMatter: {
            sidebar_label: 'Complete Reference',
            sidebar_position: 1,
            keywords: ['complete', 'guide'],
            tags: ['tutorial', 'comprehensive'],
            author: 'Documentation Team',
            draft: false,
            difficulty_level: 'beginner'
          }
        }
      ],
      keepFrontMatter: ['sidebar_label', 'sidebar_position', 'keywords', 'tags', 'author', 'draft', 'difficulty_level'],
      expectedFrontmatter: {
        sidebar_label: 'Complete Reference',
        sidebar_position: 1,
        keywords: ['complete', 'guide'],
        tags: ['tutorial', 'comprehensive'],
        author: 'Documentation Team',
        draft: false,
        difficulty_level: 'beginner'
      },
      expectedPaths: ['complete-guide.md']
    },
    {
      name: 'Non-existent fields ignored',
      docs: [
        {
          title: 'Partial Fields',
          path: 'docs/partial.md',
          content: 'Partial frontmatter content.',
          description: 'Testing partial field selection',
          url: 'https://example.com/partial',
          frontMatter: {
            sidebar_label: 'Partial Label',
            keywords: ['partial', 'test']
          }
        }
      ],
      keepFrontMatter: ['sidebar_label', 'keywords', 'non_existent_field', 'another_missing'],
      expectedFrontmatter: {
        sidebar_label: 'Partial Label',
        keywords: ['partial', 'test']
      },
      expectedPaths: ['partial.md']
    },
    {
      name: 'Mixed data types handling',
      docs: [
        {
          title: 'Mixed Types',
          path: 'docs/mixed-types.md',
          content: 'Testing mixed data types in frontmatter.',
          description: 'Mixed data types test',
          url: 'https://example.com/mixed-types',
          frontMatter: {
            title_override: 'String Value',
            position: 42,
            is_published: true,
            tags: ['array', 'values'],
            metadata: {
              version: '1.0.0',
              author_email: 'test@example.com'
            }
          }
        }
      ],
      keepFrontMatter: ['title_override', 'position', 'is_published', 'tags', 'metadata'],
      expectedFrontmatter: {
        title_override: 'String Value',
        position: 42,
        is_published: true,
        tags: ['array', 'values'],
        metadata: {
          version: '1.0.0',
          author_email: 'test@example.com'
        }
      },
      expectedPaths: ['mixed-types.md']
    }
  ];

  try {
    for (const testCase of frontmatterTestCases) {
      console.log(`Frontmatter Test: ${testCase.name}`);
      
      try {
        const result = await generateIndividualMarkdownFiles(
          testCase.docs,
          testDir,
          'https://example.com',
          'docs',
          testCase.keepFrontMatter,
          false // Don't preserve directory structure (old behavior for these tests)
        );
        
        // Check that files were created
        let filesExist = true;
        for (const expectedPath of testCase.expectedPaths) {
          const fullPath = path.join(testDir, expectedPath);
          if (!fs.existsSync(fullPath)) {
            console.log(`❌ FAIL - Expected file "${expectedPath}" not found`);
            filesExist = false;
            break;
          }
        }
        
        if (!filesExist) {
          failed++;
          await cleanupTestDirectory(testDir);
          continue;
        }
        
        // Check frontmatter content
        let frontmatterCorrect = true;
        for (let i = 0; i < testCase.expectedPaths.length; i++) {
          const expectedPath = testCase.expectedPaths[i];
          const filepath = path.join(testDir, expectedPath);
          const fileContent = fs.readFileSync(filepath, 'utf-8');
          
          const expectedKeys = Object.keys(testCase.expectedFrontmatter);
          
          if (expectedKeys.length === 0) {
            // Should not have frontmatter
            if (fileContent.startsWith('---')) {
              console.log(`❌ FAIL - Unexpected frontmatter found when none expected`);
              frontmatterCorrect = false;
              break;
            }
          } else {
            // Should have frontmatter
            if (!fileContent.startsWith('---')) {
              console.log(`❌ FAIL - Expected frontmatter not found`);
              frontmatterCorrect = false;
              break;
            }
            
            // Parse frontmatter manually for validation
            const matter = require('gray-matter');
            const parsedContent = matter(fileContent);
            
            // Check each expected field
            for (const [key, expectedValue] of Object.entries(testCase.expectedFrontmatter)) {
              if (!(key in parsedContent.data)) {
                console.log(`❌ FAIL - Missing frontmatter field: ${key}`);
                frontmatterCorrect = false;
                break;
              }
              
              const actualValue = parsedContent.data[key];
              if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
                console.log(`❌ FAIL - Frontmatter field "${key}" mismatch:`);
                console.log(`   Expected: ${JSON.stringify(expectedValue)}`);
                console.log(`   Actual: ${JSON.stringify(actualValue)}`);
                frontmatterCorrect = false;
                break;
              }
            }
            
            if (!frontmatterCorrect) break;
            
            // Check that no unexpected fields are present
            const actualKeys = Object.keys(parsedContent.data);
            for (const actualKey of actualKeys) {
              if (!expectedKeys.includes(actualKey)) {
                console.log(`❌ FAIL - Unexpected frontmatter field: ${actualKey}`);
                frontmatterCorrect = false;
                break;
              }
            }
          }
        }
        
        if (frontmatterCorrect) {
          console.log(`✅ PASS`);
          passed++;
        } else {
          failed++;
        }
        
        // Clean up for next test
        await cleanupTestDirectory(testDir);
        
      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        failed++;
      }
    }
  } finally {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }

  console.log(`\nFrontmatter Test Results: ${passed} of ${frontmatterTestCases.length} tests passed.`);
  return failed === 0;
}

// Run all tests
async function runAllTests() {
  const mainTestsPass = await runIndividualMarkdownGenerationTests();
  const edgeTestsPass = await testEdgeCases();
  const frontmatterTestsPass = await testKeepFrontMatter();
  
  if (mainTestsPass && edgeTestsPass && frontmatterTestsPass) {
    console.log('🎉 All individual markdown generation tests passed!');
  } else {
    console.log('❌ Some individual markdown generation tests failed.');
    process.exit(1);
  }
}

// Execute tests
runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
