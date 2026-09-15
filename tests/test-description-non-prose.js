/**
 * Tests that non-prose blocks are skipped during description extraction.
 * A page whose first block is a code fence, a JSX/HTML element, an admonition,
 * a table, or an image has no usable summary there; the description must come
 * from the first real paragraph instead. Several of these also produce invalid
 * markdown in the generated TOC line (an unbalanced fence, a `|` row).
 *
 * Run with: node tests/test-description-non-prose.js
 */

const fs = require('fs').promises;
const path = require('path');
const { processMarkdownFile } = require('../lib/processor');

async function setupTestDir() {
  const testDir = path.join(__dirname, 'test-description-non-prose-temp');
  try {
    await fs.rm(testDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }
  await fs.mkdir(testDir, { recursive: true });
  return testDir;
}

async function runTests() {
  console.log('Running non-prose description skip tests...\n');

  const testDir = await setupTestDir();
  let allTestsPassed = true;

  function check(label, actual, expected) {
    if (actual === expected) {
      console.log(`  ✅ PASS: ${label}`);
    } else {
      console.log(`  ❌ FAIL: ${label}`);
      console.log(`    Expected: ${JSON.stringify(expected)}`);
      console.log(`    Got:      ${JSON.stringify(actual)}`);
      allTestsPassed = false;
    }
  }

  async function describe(name, lines) {
    const file = path.join(testDir, `${name}.mdx`);
    await fs.writeFile(file, lines.join('\n'));
    const result = await processMarkdownFile(file, testDir, 'https://example.com');
    return result.description;
  }

  try {
    // Test 1: mdx-code-block wrapper after the heading (Docusaurus v2 idiom)
    console.log('Test 1: Page opening with an mdx-code-block fence');
    const desc1 = await describe('mdx-code-block', [
      '---',
      'title: Desktop Editors',
      '---',
      '',
      '# ONLYOFFICE Desktop Editors',
      '',
      '```mdx-code-block',
      "import YoutubeVideo from '@site/src/components/YoutubeVideo';",
      '',
      '<YoutubeVideo videoId="abc123"/>',
      '```',
      '',
      'There are two ways to add plugins: the plugin manager and the plugin folder.',
      ''
    ]);
    check('Fence skipped, prose used', desc1, 'There are two ways to add plugins: the plugin manager and the plugin folder.');
    console.log('');

    // Test 2: blank line inside a fence must not split it into paragraphs
    console.log('Test 2: Code fence containing a blank line');
    const desc2 = await describe('fence-blank-line', [
      '---',
      'title: Component',
      '---',
      '',
      '```ts',
      'interface Component {',
      '',
      '  name: string;',
      '}',
      '```',
      '',
      'Describes a single plugin component.',
      ''
    ]);
    check('Fence interior never becomes the description', desc2, 'Describes a single plugin component.');
    console.log('');

    // Test 3: bare JSX element before the content
    console.log('Test 3: Page opening with a JSX element');
    const desc3 = await describe('jsx-first', [
      '---',
      'title: Video Page',
      '---',
      '',
      "import YoutubeVideo from '@site/src/components/YoutubeVideo';",
      '',
      '<YoutubeVideo videoId="abc123"/>',
      '',
      'This page explains how to install the plugin.',
      ''
    ]);
    check('JSX element skipped', desc3, 'This page explains how to install the plugin.');
    console.log('');

    // Test 4: admonition markers (the `:::` markdown form, which content
    // cleaning leaves alone — only the <Admonition> tag form is stripped)
    console.log('Test 4: Page opening with an admonition');
    const desc4 = await describe('admonition-first', [
      '---',
      'title: Custom Functions',
      '---',
      '',
      ':::note',
      '',
      'Starting from version 8.1, you can add custom functions using the Macros plugin.',
      '',
      ':::',
      '',
      'Custom functions extend the spreadsheet formula set.',
      ''
    ]);
    check('Admonition marker skipped, its body used', desc4, 'Starting from version 8.1, you can add custom functions using the Macros plugin.');
    console.log('');

    // Test 5: table first (common in generated API reference pages)
    console.log('Test 5: Page opening with a table');
    const desc5 = await describe('table-first', [
      '---',
      'title: Events',
      '---',
      '',
      '| Event | Description |',
      '| ----- | ----------- |',
      '| onClick | Fires on click |',
      '',
      'The editor exposes the following events.',
      ''
    ]);
    check('Table skipped', desc5, 'The editor exposes the following events.');
    console.log('');

    // Test 6: standalone image first
    console.log('Test 6: Page opening with an image');
    const desc6 = await describe('image-first', [
      '---',
      'title: Plugin Manager',
      '---',
      '',
      '![Plugin manager](/assets/images/manager.png)',
      '',
      'The plugin manager installs plugins from the marketplace.',
      ''
    ]);
    check('Image skipped', desc6, 'The plugin manager installs plugins from the marketplace.');
    console.log('');

    // Test 7: prose starting with an inline code span is still prose
    console.log('Test 7: Paragraph starting with an inline code span');
    const desc7 = await describe('inline-code-first', [
      '---',
      'title: Config',
      '---',
      '',
      '`config.json` holds every plugin setting.',
      ''
    ]);
    check('Inline code span not mistaken for a fence', desc7, '`config.json` holds every plugin setting.');
    console.log('');

    // Test 8: a page made only of structure has no description at all
    console.log('Test 8: Page with no prose anywhere');
    const desc8 = await describe('no-prose', [
      '---',
      'title: Api',
      '---',
      '',
      "import ApiLogo from '@theme/ApiLogo';",
      '',
      '<span className="badge">Version: 3.6.0</span>',
      '',
      '<ApiLogo/>',
      ''
    ]);
    check('No description invented from structure', desc8, '');
    console.log('');

    // Test 9: existing behavior unchanged for an ordinary page
    console.log('Test 9: Ordinary page with a leading paragraph');
    const desc9 = await describe('ordinary', [
      '---',
      'title: Normal Page',
      '---',
      '',
      '# Normal Page',
      '',
      'This is a normal page with no structural blocks.',
      '',
      'A second paragraph that should be ignored.',
      ''
    ]);
    check('First paragraph still wins', desc9, 'This is a normal page with no structural blocks.');
    console.log('');

    // Test 10: frontmatter description still takes priority over everything
    console.log('Test 10: Frontmatter description priority');
    const desc10 = await describe('frontmatter-wins', [
      '---',
      'title: With Frontmatter',
      'description: Description from frontmatter',
      '---',
      '',
      '```mdx-code-block',
      '<YoutubeVideo videoId="abc123"/>',
      '```',
      '',
      'Body content.',
      ''
    ]);
    check('Frontmatter description used', desc10, 'Description from frontmatter');
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
    console.log('Results: All non-prose description skip tests passed.');
    console.log('🎉 Non-prose blocks are skipped during description extraction!');
  } else {
    console.log('Results: Some tests failed.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
