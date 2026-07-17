/**
 * Test for partial imports using the @site alias and partials directories
 *
 * Docusaurus sites commonly keep shared partials in `src/partials/` and
 * import them with the `@site` alias:
 *
 *   import PartialGettingStarted from '@site/src/partials/getting-started.mdx';
 *
 * These imports have no underscore in the path and are not relative to the
 * importing file, so they previously passed through unresolved: the import
 * line was stripped by `excludeImports`, but the `<PartialGettingStarted />`
 * JSX tag survived and the partial's content was missing from the output.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { processMarkdownFile } = require('../lib/processor');

async function setupTestFiles() {
  const siteDir = path.join(__dirname, 'test-site-alias-temp');

  // Clean up if exists
  try {
    await fs.rm(siteDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }

  await fs.mkdir(path.join(siteDir, 'src', 'partials'), { recursive: true });
  await fs.mkdir(path.join(siteDir, 'docs'), { recursive: true });

  // A partial in src/partials/ — kebab-case filename, no underscore.
  // It carries its own component import, which must NOT leak into output.
  const partialContent = `import Tabs from '@theme/Tabs';

To open the editor:

1. Log in to your account.
1. Select your project and click **Edit**.

The editor saves automatically.`;

  await fs.writeFile(
    path.join(siteDir, 'src', 'partials', 'opening-the-editor.mdx'),
    partialContent
  );

  // A doc importing the partial via the @site alias, using it both in
  // block context and inside a numbered list.
  const mainContent = `---
title: Editing your project
description: How to edit a project
---

import PartialOpeningTheEditor from '@site/src/partials/opening-the-editor.mdx';

# Editing your project

<PartialOpeningTheEditor />

## Step by step

1. <PartialOpeningTheEditor />
1. Make your changes.`;

  await fs.writeFile(path.join(siteDir, 'docs', 'editing.mdx'), mainContent);

  return siteDir;
}

async function runTest() {
  console.log('Testing @site alias partial resolution...\n');

  const siteDir = await setupTestFiles();

  // Deliberately run from a cwd that is NOT the site directory, so the test
  // proves `@site` resolves via the explicit siteDir argument rather than
  // process.cwd().
  const originalCwd = process.cwd();
  process.chdir(os.tmpdir());

  try {
    const docPath = path.join(siteDir, 'docs', 'editing.mdx');
    const result = await processMarkdownFile(
      docPath,
      path.join(siteDir, 'docs'),
      'https://example.com',
      'docs',
      undefined,
      true, // excludeImports
      false, // removeDuplicateHeadings
      undefined, // resolvedUrl
      undefined, // imageAssetMap
      undefined, // outDir
      siteDir // siteDir — used to resolve @site/ imports
    );

    let allTestsPassed = true;

    // Test 1: the JSX tag must be gone
    if (result.content.includes('<PartialOpeningTheEditor')) {
      console.log('❌ Test 1 failed: unresolved <PartialOpeningTheEditor> tag left in output');
      allTestsPassed = false;
    } else {
      console.log('✅ Test 1 passed: no unresolved partial tag in output');
    }

    // Test 2: the partial's content must be present (block context)
    if (!result.content.includes('The editor saves automatically.')) {
      console.log('❌ Test 2 failed: partial content missing from output');
      allTestsPassed = false;
    } else {
      console.log('✅ Test 2 passed: partial content inlined');
    }

    // Test 3: the partial's own import must not leak as text
    if (/import Tabs from/.test(result.content)) {
      console.log("❌ Test 3 failed: partial's own import line leaked into output");
      allTestsPassed = false;
    } else {
      console.log("✅ Test 3 passed: partial's import lines stripped");
    }

    // Test 4: list-context usage also resolved
    const occurrences = (result.content.match(/Select your project and click/g) || []).length;
    if (occurrences < 2) {
      console.log(`❌ Test 4 failed: expected partial content in both block and list context (found ${occurrences})`);
      allTestsPassed = false;
    } else {
      console.log('✅ Test 4 passed: partial resolved in list context too');
    }

    // Test 5: relative underscore convention still works (regression guard)
    // — covered by test-partials.js; here we just confirm the doc's own
    // content survived processing.
    if (!result.content.includes('Make your changes.')) {
      console.log('❌ Test 5 failed: surrounding document content lost');
      allTestsPassed = false;
    } else {
      console.log('✅ Test 5 passed: surrounding document content intact');
    }

    if (!allTestsPassed) {
      process.exitCode = 1;
    } else {
      console.log('\nAll @site alias partial tests passed!');
    }
  } finally {
    process.chdir(originalCwd);
    // Clean up test files
    try {
      await fs.rm(siteDir, { recursive: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exitCode = 1;
});
