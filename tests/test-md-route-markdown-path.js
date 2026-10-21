/**
 * Unit tests for issue #98: generateIndividualMarkdownFiles must not strip a
 * trailing `.md` or `.mdx` from a URL the processor built. A processor URL
 * never carries a source-file extension, so a trailing `.md` there is part of
 * the page's route (`slug: fiber.md`), and Docusaurus builds that page into
 * the directory `guide/fiber.md/`. The Markdown copy goes beside it, as
 * `guide/fiber.md.md`. A URL from outside the processor (no `routeResolved`)
 * that still carries its source extension keeps being collapsed, so
 * `config.md` doesn't become `config.md.md`.
 *
 * Run with: node tests/test-md-route-markdown-path.js
 */

const fs = require('fs').promises;
const path = require('path');
const { generateIndividualMarkdownFiles } = require('../lib/generator');

const siteUrl = 'https://example.com';

async function setupTestDir() {
  const testDir = path.join(__dirname, 'test-md-route-markdown-path-temp');

  try {
    await fs.rm(testDir, { recursive: true });
  } catch {
    // Ignore if doesn't exist
  }

  await fs.mkdir(testDir, { recursive: true });

  return testDir;
}

async function isFile(filePath) {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function runTests() {
  console.log('Running markdown path tests for routes that end in .md (#98)...\n');

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
    // Test 1: a resolved route that ends in .md is a directory in the build
    // output, so the copy is written beside it as fiber.md.md.
    console.log('Test 1: resolved route ending in .md');
    const resolvedDir = path.join(testDir, 'resolved');
    await fs.mkdir(path.join(resolvedDir, 'guide', 'fiber.md'), { recursive: true });
    await fs.writeFile(path.join(resolvedDir, 'guide', 'fiber.md', 'index.html'), '<html></html>');
    const [resolvedDoc] = await generateIndividualMarkdownFiles(
      [
        {
          title: 'Fiber',
          path: 'docs/guide/fiber.md',
          url: `${siteUrl}/guide/fiber.md`,
          content: 'Fiber body.',
          description: 'Fibers.',
          frontMatter: { slug: 'fiber.md' },
          routeResolved: true,
        },
      ],
      resolvedDir,
      siteUrl,
    );
    check(
      'guide/fiber.md.md is written',
      await isFile(path.join(resolvedDir, 'guide', 'fiber.md.md')),
    );
    check(
      'route directory guide/fiber.md/ is untouched',
      await isFile(path.join(resolvedDir, 'guide', 'fiber.md', 'index.html')),
    );
    check(
      'link points at the copy',
      resolvedDoc.url === `${siteUrl}/guide/fiber.md.md` &&
        resolvedDoc.path === '/guide/fiber.md.md',
    );
    console.log('');

    // Test 2: a route the processor derived the way Docusaurus does (no route
    // match) is handled the same way.
    console.log('Test 2: derived route ending in .md');
    const derivedDir = path.join(testDir, 'derived');
    const [derivedDoc] = await generateIndividualMarkdownFiles(
      [
        {
          title: 'STM',
          path: 'docs/guide/stm.md',
          url: `${siteUrl}/guide/stm.md`,
          content: 'STM body.',
          description: 'Transactions.',
          frontMatter: { slug: 'stm.md' },
          routeResolved: false,
        },
      ],
      derivedDir,
      siteUrl,
    );
    check('guide/stm.md.md is written', await isFile(path.join(derivedDir, 'guide', 'stm.md.md')));
    check('link points at the copy', derivedDoc.url === `${siteUrl}/guide/stm.md.md`);
    console.log('');

    // Test 3: a resolved route ending in .mdx keeps its extension too.
    console.log('Test 3: resolved route ending in .mdx');
    const mdxDir = path.join(testDir, 'mdx');
    const [mdxDoc] = await generateIndividualMarkdownFiles(
      [
        {
          title: 'Notes',
          path: 'docs/guide/notes.mdx',
          url: `${siteUrl}/guide/notes.mdx`,
          content: 'Notes body.',
          description: 'Notes.',
          frontMatter: { slug: 'notes.mdx' },
          routeResolved: true,
        },
      ],
      mdxDir,
      siteUrl,
    );
    check(
      'guide/notes.mdx.md is written',
      await isFile(path.join(mdxDir, 'guide', 'notes.mdx.md')),
    );
    check('link points at the copy', mdxDoc.url === `${siteUrl}/guide/notes.mdx.md`);
    console.log('');

    // Test 4: a doc built without the processor, whose URL still carries its
    // source extension, is collapsed to a single .md as before.
    console.log('Test 4: URL from outside the processor that ends in .md');
    const externalDir = path.join(testDir, 'external');
    const [externalDoc] = await generateIndividualMarkdownFiles(
      [
        {
          title: 'Config',
          path: 'docs/config.md',
          url: `${siteUrl}/docs/config.md`,
          content: 'Config body.',
          description: 'Configuration.',
        },
      ],
      externalDir,
      siteUrl,
    );
    check('docs/config.md is written', await isFile(path.join(externalDir, 'docs', 'config.md')));
    check('no docs/config.md.md', !(await isFile(path.join(externalDir, 'docs', 'config.md.md'))));
    check('link has a single .md', externalDoc.url === `${siteUrl}/docs/config.md`);
    console.log('');
  } catch (error) {
    console.error('Test error:', error);
    allTestsPassed = false;
  } finally {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  if (allTestsPassed) {
    console.log('Results: All markdown path tests passed.');
  } else {
    console.log('Results: Some tests failed.');
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
