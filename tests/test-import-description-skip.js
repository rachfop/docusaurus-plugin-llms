/**
 * Tests that import/export statements are skipped during description extraction.
 * Verifies the fix for issue #9: .mdx files starting with import statements
 * should not use the import line as the page description.
 *
 * Run with: node tests/test-import-description-skip.js
 */

const fs = require('fs').promises;
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');

async function setupTestDir() {
  const testDir = path.join(__dirname, 'test-import-description-skip-temp');
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }
  await fs.mkdir(testDir, { recursive: true });
  return testDir;
}

async function runTests() {
  console.log('Running import/export description skip tests...\n');

  const testDir = await setupTestDir();
  let allTestsPassed = true;

  function check(label, condition) {
    if (condition) {
      console.log(`  ✅ PASS: ${label}`);
    } else {
      console.log(`  ❌ FAIL: ${label}`);
      allTestsPassed = false;
    }
  }

  try {
    // Test 1: Import statement before content paragraph
    console.log('Test 1: MDX file with import before content');
    const file1 = path.join(testDir, 'with-import.mdx');
    await fs.writeFile(file1, [
      '---',
      'title: Concepts',
      '---',
      '',
      "import CodePanel from '@site/src/theme/CodePanel';",
      '',
      'Agents are autonomous systems that understand natural language and use tools.',
      ''
    ].join('\n'));
    const result1 = await processMarkdownFile(file1, testDir, 'https://example.com');
    check(
      'Description is content paragraph, not import',
      result1.description === 'Agents are autonomous systems that understand natural language and use tools.'
    );
    if (result1.description !== 'Agents are autonomous systems that understand natural language and use tools.') {
      console.log(`    Got: "${result1.description}"`);
    }
    console.log('');

    // Test 2: Multiple imports before content
    console.log('Test 2: MDX file with multiple imports before content');
    const file2 = path.join(testDir, 'multi-import.mdx');
    await fs.writeFile(file2, [
      '---',
      'title: Multi Import',
      '---',
      '',
      "import CodePanel from '@site/src/theme/CodePanel';",
      '',
      "import Tabs from '@theme/Tabs';",
      '',
      'This is the actual description of the page.',
      ''
    ].join('\n'));
    const result2 = await processMarkdownFile(file2, testDir, 'https://example.com');
    check(
      'Skips multiple imports to find real content',
      result2.description === 'This is the actual description of the page.'
    );
    if (result2.description !== 'This is the actual description of the page.') {
      console.log(`    Got: "${result2.description}"`);
    }
    console.log('');

    // Test 3: Export statement before content
    console.log('Test 3: MDX file with export before content');
    const file3 = path.join(testDir, 'with-export.mdx');
    await fs.writeFile(file3, [
      '---',
      'title: With Export',
      '---',
      '',
      "export const meta = { version: '1.0' };",
      '',
      'This page documents our export functionality.',
      ''
    ].join('\n'));
    const result3 = await processMarkdownFile(file3, testDir, 'https://example.com');
    check(
      'Export statement skipped, real content used',
      result3.description === 'This page documents our export functionality.'
    );
    if (result3.description !== 'This page documents our export functionality.') {
      console.log(`    Got: "${result3.description}"`);
    }
    console.log('');

    // Test 4: No import — normal content still works
    console.log('Test 4: Normal MDX file without imports');
    const file4 = path.join(testDir, 'no-import.mdx');
    await fs.writeFile(file4, [
      '---',
      'title: Normal Page',
      '---',
      '',
      'This is a normal page with no imports at all.',
      ''
    ].join('\n'));
    const result4 = await processMarkdownFile(file4, testDir, 'https://example.com');
    check(
      'Normal page description extracted correctly',
      result4.description === 'This is a normal page with no imports at all.'
    );
    console.log('');

    // Test 5: Frontmatter description takes priority over content
    console.log('Test 5: Frontmatter description takes priority');
    const file5 = path.join(testDir, 'frontmatter-desc.mdx');
    await fs.writeFile(file5, [
      '---',
      'title: With Frontmatter',
      'description: Description from frontmatter',
      '---',
      '',
      "import Something from '@site/src/Something';",
      '',
      'This is body content.',
      ''
    ].join('\n'));
    const result5 = await processMarkdownFile(file5, testDir, 'https://example.com');
    check(
      'Frontmatter description used over body content',
      result5.description === 'Description from frontmatter'
    );
    console.log('');

    // Test 6: File with only imports and heading, no content paragraph
    console.log('Test 6: File with only imports and heading');
    const file6 = path.join(testDir, 'only-imports.mdx');
    await fs.writeFile(file6, [
      '---',
      'title: Only Imports',
      '---',
      '',
      "import A from '@site/A';",
      '',
      "import B from '@site/B';",
      ''
    ].join('\n'));
    const result6 = await processMarkdownFile(file6, testDir, 'https://example.com');
    check(
      'No import used as description when no content exists',
      !result6.description.startsWith('import')
    );
    console.log('');

  } catch (error) {
    console.error('Test error:', error);
    allTestsPassed = false;
  } finally {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  if (allTestsPassed) {
    console.log('Results: All import/export description skip tests passed.');
    console.log('🎉 Import/export description skipping is working correctly!');
  } else {
    console.log('Results: Some tests failed.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
