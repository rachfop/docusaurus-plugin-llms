/**
 * Tests for array bounds checking in path operations: duplicate titles in
 * llms-full.txt get a folder-name or numeric suffix from the real
 * generateLLMFile, whatever the shape of the doc's path.
 *
 * Run with: node test-path-bounds-checking.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { generateLLMFile } = require('../lib/generator');

// Test cases for path bounds checking
const testCases = [
  {
    name: 'Single element path (edge case - should not crash)',
    docs: [
      {
        title: 'Tutorial',
        path: 'tutorial.md', // Single element path - no folder
        content: '# Tutorial\n\nFirst tutorial.',
        description: 'First tutorial',
        url: 'https://example.com/tutorial',
      },
      {
        title: 'Tutorial',
        path: 'guide.md', // Another single element path
        content: '# Tutorial\n\nSecond tutorial.',
        description: 'Second tutorial',
        url: 'https://example.com/guide',
      },
    ],
    expectedHeaders: ['Tutorial', 'Tutorial (2)'], // Should fall back to numeric counter
    description:
      'Single element paths should not cause array bounds issues and should fall back to numeric counters',
  },
  {
    name: 'Empty path (edge case)',
    docs: [
      {
        title: 'Guide',
        path: '', // Empty path
        content: '# Guide\n\nFirst guide.',
        description: 'First guide',
        url: 'https://example.com/guide1',
      },
      {
        title: 'Guide',
        path: '', // Empty path
        content: '# Guide\n\nSecond guide.',
        description: 'Second guide',
        url: 'https://example.com/guide2',
      },
    ],
    expectedHeaders: ['Guide', 'Guide (2)'], // Should fall back to numeric counter
    description: 'Empty paths should not cause crashes and should use numeric counters',
  },
  {
    name: 'Root level path with leading slash',
    docs: [
      {
        title: 'README',
        path: '/readme.md', // Path with leading slash but no folder
        content: '# README\n\nFirst readme.',
        description: 'First readme',
        url: 'https://example.com/readme1',
      },
      {
        title: 'README',
        path: '/index.md', // Another root level path
        content: '# README\n\nSecond readme.',
        description: 'Second readme',
        url: 'https://example.com/readme2',
      },
    ],
    expectedHeaders: ['README', 'README (2)'], // Should fall back to numeric counter
    description: 'Root level paths with leading slashes should be handled correctly',
  },
  {
    name: 'Normal two-level path (should use folder name)',
    docs: [
      {
        title: 'Configuration',
        path: 'docs/configuration.md', // Two elements - should extract "docs"
        content: '# Configuration\n\nFirst config.',
        description: 'First config',
        url: 'https://example.com/config1',
      },
      {
        title: 'Configuration',
        path: 'guides/configuration.md', // Two elements - should extract "guides"
        content: '# Configuration\n\nSecond config.',
        description: 'Second config',
        url: 'https://example.com/config2',
      },
    ],
    expectedHeaders: ['Configuration', 'Configuration (Guides)'], // Should use folder name
    description: 'Two-level paths should correctly extract and use the folder name',
  },
  {
    name: 'Mixed path lengths',
    docs: [
      {
        title: 'API',
        path: 'api.md', // Single element
        content: '# API\n\nFirst API.',
        description: 'First API',
        url: 'https://example.com/api1',
      },
      {
        title: 'API',
        path: 'reference/api.md', // Two elements - should extract "reference"
        content: '# API\n\nSecond API.',
        description: 'Second API',
        url: 'https://example.com/api2',
      },
      {
        title: 'API',
        path: 'docs/advanced/api.md', // Three elements - should extract "advanced"
        content: '# API\n\nThird API.',
        description: 'Third API',
        url: 'https://example.com/api3',
      },
    ],
    expectedHeaders: ['API', 'API (Reference)', 'API (Advanced)'], // Mixed: numeric, folder name, folder name
    description: 'Paths with different depths should all be handled correctly',
  },
  {
    name: 'Path with multiple slashes',
    docs: [
      {
        title: 'Setup',
        path: '///', // Only slashes
        content: '# Setup\n\nFirst setup.',
        description: 'First setup',
        url: 'https://example.com/setup1',
      },
      {
        title: 'Setup',
        path: '//', // Only slashes
        content: '# Setup\n\nSecond setup.',
        description: 'Second setup',
        url: 'https://example.com/setup2',
      },
    ],
    expectedHeaders: ['Setup', 'Setup (2)'], // Should fall back to numeric counter
    description: 'Paths with only slashes should be handled gracefully',
  },
];

async function runTests() {
  console.log('Running path bounds checking tests...\n');

  let passCount = 0;
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-path-bounds-'));

  try {
    for (const [index, test] of testCases.entries()) {
      console.log(`Test ${index + 1}: ${test.name}`);
      console.log(`  ${test.description}`);

      try {
        const outputPath = path.join(outDir, `llms-full-${index}.txt`);
        await generateLLMFile(
          test.docs,
          outputPath,
          'Test Documentation',
          'Test description',
          true,
          'test-version',
        );
        const output = fs.readFileSync(outputPath, 'utf8');

        // Extract H2 headers from the output (document sections should be H2)
        const headerMatches = output.match(/^## .+$/gm) || [];
        const actualHeaders = headerMatches.map((h) => h.replace(/^## /, ''));

        console.log(`  Expected headers: ${test.expectedHeaders.join(', ')}`);
        console.log(`  Actual headers: ${actualHeaders.join(', ')}`);

        const headersMatch =
          actualHeaders.length === test.expectedHeaders.length &&
          actualHeaders.every((header, i) => header === test.expectedHeaders[i]);

        if (headersMatch) {
          console.log('  ✅ PASS');
          passCount++;
        } else {
          console.log('  ❌ FAIL');
        }
      } catch (error) {
        console.log('  ❌ ERROR:', error.message);
      }

      console.log('');
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }

  console.log(`Results: ${passCount} of ${testCases.length} tests passed.`);

  if (passCount === testCases.length) {
    console.log('🎉 All path bounds checking tests passed!');
  } else {
    console.log('❌ Some path bounds checking tests failed.');
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
