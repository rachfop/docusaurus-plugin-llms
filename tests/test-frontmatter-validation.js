/**
 * Tests for frontMatter type validation
 * Validates that slug and id fields are properly validated before using string methods
 *
 * Run with: node test-frontmatter-validation.js
 */

const fs = require('fs');
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

// Helper function to clean up test directory
async function cleanupTestDirectory(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // Recreate empty directory for next test
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Test cases for non-string frontmatter values
 * These should be ignored gracefully without causing runtime errors
 */
const testCases = [
  {
    name: 'Non-string slug (number)',
    docs: [
      {
        title: 'Test Document',
        path: 'docs/test.md',
        content: 'Test content',
        description: 'Test with numeric slug',
        url: 'https://example.com/test',
        frontMatter: {
          slug: 12345  // Number instead of string
        }
      }
    ],
    // Should fall back to original path since slug is not a string
    expectedPaths: ['test.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string slug (boolean)',
    docs: [
      {
        title: 'Boolean Slug',
        path: 'docs/boolean-slug.md',
        content: 'Test content with boolean slug',
        description: 'Test with boolean slug',
        url: 'https://example.com/boolean',
        frontMatter: {
          slug: true  // Boolean instead of string
        }
      }
    ],
    expectedPaths: ['boolean-slug.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string slug (object)',
    docs: [
      {
        title: 'Object Slug',
        path: 'docs/object-slug.md',
        content: 'Test content with object slug',
        description: 'Test with object slug',
        url: 'https://example.com/object',
        frontMatter: {
          slug: { nested: 'value' }  // Object instead of string
        }
      }
    ],
    expectedPaths: ['object-slug.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string slug (array)',
    docs: [
      {
        title: 'Array Slug',
        path: 'docs/array-slug.md',
        content: 'Test content with array slug',
        description: 'Test with array slug',
        url: 'https://example.com/array',
        frontMatter: {
          slug: ['path', 'segments']  // Array instead of string
        }
      }
    ],
    expectedPaths: ['array-slug.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string slug (null)',
    docs: [
      {
        title: 'Null Slug',
        path: 'docs/null-slug.md',
        content: 'Test content with null slug',
        description: 'Test with null slug',
        url: 'https://example.com/null',
        frontMatter: {
          slug: null  // Null value
        }
      }
    ],
    expectedPaths: ['null-slug.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string id (number)',
    docs: [
      {
        title: 'Numeric ID',
        path: 'docs/numeric-id.md',
        content: 'Test content with numeric id',
        description: 'Test with numeric id',
        url: 'https://example.com/numeric',
        frontMatter: {
          id: 99999  // Number instead of string
        }
      }
    ],
    expectedPaths: ['numeric-id.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string id (boolean)',
    docs: [
      {
        title: 'Boolean ID',
        path: 'docs/boolean-id.md',
        content: 'Test content with boolean id',
        description: 'Test with boolean id',
        url: 'https://example.com/bool',
        frontMatter: {
          id: false  // Boolean instead of string
        }
      }
    ],
    expectedPaths: ['boolean-id.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string id (object)',
    docs: [
      {
        title: 'Object ID',
        path: 'docs/object-id.md',
        content: 'Test content with object id',
        description: 'Test with object id',
        url: 'https://example.com/obj',
        frontMatter: {
          id: { key: 'value' }  // Object instead of string
        }
      }
    ],
    expectedPaths: ['object-id.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string id (array)',
    docs: [
      {
        title: 'Array ID',
        path: 'docs/array-id.md',
        content: 'Test content with array id',
        description: 'Test with array id',
        url: 'https://example.com/arr',
        frontMatter: {
          id: ['id', 'parts']  // Array instead of string
        }
      }
    ],
    expectedPaths: ['array-id.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Both slug and id non-string',
    docs: [
      {
        title: 'Both Invalid',
        path: 'docs/both-invalid.md',
        content: 'Test content with both invalid',
        description: 'Test with both slug and id invalid',
        url: 'https://example.com/both',
        frontMatter: {
          slug: 123,
          id: true
        }
      }
    ],
    expectedPaths: ['both-invalid.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Non-string slug with valid string id',
    docs: [
      {
        title: 'Invalid Slug Valid ID',
        path: 'docs/mixed-validation.md',
        content: 'Test content with invalid slug but valid id',
        description: 'Test mixed validation',
        url: 'https://example.com/mixed',
        frontMatter: {
          slug: 456,  // Invalid - should be ignored
          id: 'valid-id'  // Valid - should be used
        }
      }
    ],
    // Should use the valid id, ignoring the invalid slug
    expectedPaths: ['valid-id.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Valid slug with non-string id',
    docs: [
      {
        title: 'Valid Slug Invalid ID',
        path: 'docs/another-mixed.md',
        content: 'Test content with valid slug but invalid id',
        description: 'Test mixed validation (reverse)',
        url: 'https://example.com/mixed2',
        frontMatter: {
          slug: 'valid-slug',  // Valid - should be used
          id: false  // Invalid - should be ignored (slug takes precedence anyway)
        }
      }
    ],
    // Should use the valid slug
    expectedPaths: ['valid-slug.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Undefined slug and id',
    docs: [
      {
        title: 'Undefined Values',
        path: 'docs/undefined-values.md',
        content: 'Test content with undefined values',
        description: 'Test undefined values',
        url: 'https://example.com/undefined',
        frontMatter: {
          slug: undefined,
          id: undefined
        }
      }
    ],
    expectedPaths: ['undefined-values.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Empty string slug (should fall back to path)',
    docs: [
      {
        title: 'Empty String Slug',
        path: 'docs/empty-string-slug.md',
        content: 'Test content with empty string slug',
        description: 'Test empty string slug',
        url: 'https://example.com/empty',
        frontMatter: {
          slug: ''  // Empty string - is a string, but should fall back to path
        }
      }
    ],
    expectedPaths: ['empty-string-slug.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Whitespace-only slug (should fall back to path)',
    docs: [
      {
        title: 'Whitespace Slug',
        path: 'docs/whitespace-slug.md',
        content: 'Test content with whitespace slug',
        description: 'Test whitespace slug',
        url: 'https://example.com/whitespace',
        frontMatter: {
          slug: '   '  // Whitespace only - is a string, but should fall back
        }
      }
    ],
    expectedPaths: ['whitespace-slug.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Empty string title (should use fallback)',
    docs: [
      {
        title: 'Empty Title',
        path: 'docs/empty-title.md',
        content: '# First Heading\n\nTest content with empty title in frontmatter',
        description: 'Test empty title',
        url: 'https://example.com/empty-title',
        frontMatter: {
          title: ''  // Empty string - should use first heading
        }
      }
    ],
    expectedPaths: ['empty-title.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Whitespace-only title (should use fallback)',
    docs: [
      {
        title: 'Whitespace Title',
        path: 'docs/whitespace-title.md',
        content: '# Actual Title\n\nTest content with whitespace title',
        description: 'Test whitespace title',
        url: 'https://example.com/whitespace-title',
        frontMatter: {
          title: '  \t  '  // Whitespace only - should use first heading
        }
      }
    ],
    expectedPaths: ['whitespace-title.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Empty string description (should use fallback)',
    docs: [
      {
        title: 'Empty Description',
        path: 'docs/empty-description.md',
        content: 'Test content with empty description.\n\nThis is the first paragraph.',
        description: '',  // Empty description in frontmatter
        url: 'https://example.com/empty-description',
        frontMatter: {
          description: ''  // Empty string - should use first paragraph
        }
      }
    ],
    expectedPaths: ['empty-description.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Whitespace-only description (should use fallback)',
    docs: [
      {
        title: 'Whitespace Description',
        path: 'docs/whitespace-description.md',
        content: 'First paragraph content.\n\nSecond paragraph.',
        description: '',  // Will be empty after trim
        url: 'https://example.com/whitespace-description',
        frontMatter: {
          description: '   \n\t   '  // Whitespace only - should use first paragraph
        }
      }
    ],
    expectedPaths: ['whitespace-description.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Empty string id (should fall back to path)',
    docs: [
      {
        title: 'Empty ID',
        path: 'docs/empty-id.md',
        content: 'Test content with empty id',
        description: 'Test empty id',
        url: 'https://example.com/empty-id',
        frontMatter: {
          id: ''  // Empty string - should fall back to path
        }
      }
    ],
    expectedPaths: ['empty-id.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Whitespace-only id (should fall back to path)',
    docs: [
      {
        title: 'Whitespace ID',
        path: 'docs/whitespace-id.md',
        content: 'Test content with whitespace id',
        description: 'Test whitespace id',
        url: 'https://example.com/whitespace-id',
        frontMatter: {
          id: '\t  \n  '  // Whitespace only - should fall back
        }
      }
    ],
    expectedPaths: ['whitespace-id.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Multiple empty frontmatter fields',
    docs: [
      {
        title: 'Multiple Empty Fields',
        path: 'docs/multiple-empty.md',
        content: '# Fallback Title\n\nFallback description paragraph.',
        description: '',
        url: 'https://example.com/multiple-empty',
        frontMatter: {
          title: '',
          description: '  ',
          slug: '\t',
          id: ''
        }
      }
    ],
    expectedPaths: ['multiple-empty.md'],
    siteUrl: 'https://example.com'
  },
  {
    name: 'Nested path with non-string slug',
    docs: [
      {
        title: 'Nested Invalid',
        path: 'docs/guides/nested/deep.md',
        content: 'Test nested path with invalid slug',
        description: 'Test nested paths',
        url: 'https://example.com/nested',
        frontMatter: {
          slug: { path: 'invalid' }  // Object instead of string
        }
      }
    ],
    expectedPaths: ['guides/nested/deep.md'],  // preserveDirectoryStructure=false strips only 'docs'
    siteUrl: 'https://example.com'
  }
];

async function runFrontmatterValidationTests() {
  console.log('Running frontMatter validation tests...\n');

  let passed = 0;
  let failed = 0;

  // Create a temporary test directory
  const testDir = path.join(__dirname, 'test-frontmatter-validation');

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
          'docs',
          [],
          false // Don't preserve directory structure for these tests
        );

        // Check that the expected files were created at the correct paths
        let pathsCorrect = true;

        for (let i = 0; i < testCase.expectedPaths.length; i++) {
          const expectedPath = testCase.expectedPaths[i];
          const fullPath = path.join(testDir, expectedPath);

          if (!fs.existsSync(fullPath)) {
            console.log(`❌ FAIL - Expected file at path "${expectedPath}" not found`);
            console.log(`   Available files:`, fs.readdirSync(testDir, { recursive: true }));
            pathsCorrect = false;
            break;
          }
        }

        if (!pathsCorrect) {
          failed++;
          await cleanupTestDirectory(testDir);
          continue;
        }

        // Check that the result array has the correct length
        if (result.length !== testCase.expectedPaths.length) {
          console.log(`❌ FAIL - Expected ${testCase.expectedPaths.length} results, got ${result.length}`);
          failed++;
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

        console.log(`✅ PASS`);
        passed++;

        // Clean up for next test
        await cleanupTestDirectory(testDir);

      } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        console.log(error.stack);
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
  console.log(`FrontMatter Validation Tests Summary:`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run tests
runFrontmatterValidationTests().then(success => {
  if (success) {
    console.log('🎉 All frontMatter validation tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some frontMatter validation tests failed.');
    process.exit(1);
  }
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
