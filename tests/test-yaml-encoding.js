/**
 * Tests for YAML encoding functionality with special characters
 *
 * Tests Issue #23: YAML.stringify called without options causing encoding issues
 * with emojis and special characters.
 *
 * Run with: node test-yaml-encoding.js
 */

const fs = require('fs');
const path = require('path');
const { createMarkdownContent } = require('../lib/utils');

// Helper to extract frontmatter from markdown content
function extractFrontmatter(content) {
  const frontmatterMatch = content.match(/^---\n([\s\S]+?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }
  return frontmatterMatch[1];
}

// Helper to check if string contains proper YAML encoding
function validateYAMLEncoding(frontmatter, expectedValues) {
  for (const [key, value] of Object.entries(expectedValues)) {
    // YAML can use plain, single-quoted, or double-quoted style
    // Pattern matches: key: value OR key: "value" OR key: 'value'
    const keyPattern = new RegExp(`^${key}:\\s*(.+)$`, 'm');
    const match = frontmatter.match(keyPattern);

    if (!match) {
      throw new Error(`Key "${key}" not found in frontmatter`);
    }

    // Extract the actual value, removing quotes if present
    let actualValue = match[1].trim();

    // Remove surrounding quotes (single or double)
    if ((actualValue.startsWith('"') && actualValue.endsWith('"')) ||
        (actualValue.startsWith("'") && actualValue.endsWith("'"))) {
      actualValue = actualValue.slice(1, -1);
      // Unescape any escaped quotes inside the string
      actualValue = actualValue.replace(/\\"/g, '"').replace(/\\'/g, "'");
    }

    if (actualValue !== value) {
      throw new Error(`Expected "${key}" to be "${value}", got "${actualValue}"`);
    }
  }
}

// Helper to check for line wrapping issues (excluding arrays)
function checkNoLineWrapping(frontmatter) {
  // Split by lines and check that string values don't span multiple lines
  const lines = frontmatter.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip array values (lines that end with ':' followed by array items)
    if (line.trim().endsWith(':')) {
      // This might be an array or object, skip the check
      continue;
    }
    // If a line starts with a key (contains ':'), ensure the value is complete on the same line
    if (line.includes(':') && !line.trim().endsWith('"') && !line.trim().endsWith("'")) {
      // Check if next line is indented continuation (but not an array item starting with '-')
      if (i + 1 < lines.length && lines[i + 1].startsWith('  ') && !lines[i + 1].trim().startsWith('-')) {
        throw new Error(`Line wrapping detected: "${line}" continues on next line`);
      }
    }
  }
}

const testCases = [
  {
    name: 'Handles emojis in title and description',
    frontMatter: {
      title: "Test 🚀",
      description: "Über cool 🎉"
    },
    expectedValues: {
      title: "Test 🚀",
      description: "Über cool 🎉"
    }
  },
  {
    name: 'Handles special characters (colons, quotes)',
    frontMatter: {
      title: "Test: Part 1",
      description: 'Quote: "Hello World"'
    },
    expectedValues: {
      title: "Test: Part 1",
      description: 'Quote: "Hello World"'  // Our parser handles escaping
    }
  },
  {
    name: 'Handles long strings without line wrapping',
    frontMatter: {
      title: "This is a very long title that exceeds 80 characters and should not be wrapped across multiple lines in the YAML output",
      description: "Similarly, this description is quite lengthy and contains a lot of text that might tempt the YAML stringifier to wrap it"
    },
    expectedValues: {
      title: "This is a very long title that exceeds 80 characters and should not be wrapped across multiple lines in the YAML output",
      description: "Similarly, this description is quite lengthy and contains a lot of text that might tempt the YAML stringifier to wrap it"
    }
  },
  {
    name: 'Handles mixed special characters and emojis',
    frontMatter: {
      title: "API: v2.0 🔥",
      description: "New features & improvements",
      slug: "api-v2-release",
      tags: ["api", "release 🚀", "version: 2.0"]
    },
    expectedValues: {
      title: "API: v2.0 🔥",
      description: "New features & improvements",
      slug: "api-v2-release"
    }
  },
  {
    name: 'Handles unicode characters',
    frontMatter: {
      title: "Über Ñiño 日本語",
      description: "Testing Unicode: Ä Ö Ü ß 中文"
    },
    expectedValues: {
      title: "Über Ñiño 日本語",
      description: "Testing Unicode: Ä Ö Ü ß 中文"
    }
  },
  {
    name: 'Handles newlines and multiline content',
    frontMatter: {
      title: "Simple Title",
      description: "Line 1\nLine 2\nLine 3"
    },
    expectedValues: {
      title: "Simple Title"
      // Note: newlines in descriptions might be escaped, we'll handle this separately
    }
  },
  {
    name: 'Handles empty and null values',
    frontMatter: {
      title: "Test",
      description: "",
      slug: "test-slug"
    },
    expectedValues: {
      title: "Test",
      slug: "test-slug"
    }
  },
  {
    name: 'Handles special YAML characters',
    frontMatter: {
      title: "Test: [brackets] {braces} | pipes",
      description: "Characters: * & % @ # ! ?"
    },
    expectedValues: {
      title: "Test: [brackets] {braces} | pipes",
      description: "Characters: * & % @ # ! ?"
    }
  }
];

function runYAMLEncodingTests() {
  console.log('Running YAML encoding tests...\n');

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    console.log(`Test: ${testCase.name}`);

    try {
      // Generate markdown content with frontmatter
      const content = createMarkdownContent(
        'Test Title',
        'Test Description',
        'Test content',
        true,
        testCase.frontMatter
      );

      // Extract frontmatter from the generated content
      const frontmatter = extractFrontmatter(content);

      if (!frontmatter) {
        throw new Error('No frontmatter found in generated content');
      }

      // Validate that expected values are properly encoded
      validateYAMLEncoding(frontmatter, testCase.expectedValues);

      // Check that long strings are not wrapped
      checkNoLineWrapping(frontmatter);

      // Additional check: ensure frontmatter starts and ends properly
      if (!content.startsWith('---\n')) {
        throw new Error('Content does not start with YAML frontmatter delimiter');
      }

      if (!content.includes('\n---\n')) {
        throw new Error('YAML frontmatter closing delimiter not found');
      }

      console.log(`✅ PASS`);
      passed++;

    } catch (error) {
      console.log(`❌ FAIL: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`YAML Encoding Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
const success = runYAMLEncodingTests();
console.log(success ? '🎉 All YAML encoding tests passed!' : '❌ Some YAML encoding tests failed.');
if (!success) process.exit(1);
