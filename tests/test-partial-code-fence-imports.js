/**
 * Test that code samples inside partials survive the import strip
 *
 * When a partial is inlined into a page, its own component imports are
 * removed — they reference things like '@theme/Tabs' that mean nothing in
 * plain markdown. That strip is line-based, so it also matched any line
 * beginning with `import` inside a fenced code block:
 *
 *   ```swift
 *   import Foundation   <- deleted from the middle of the sample
 *   ```
 *
 * The failure was silent: the page still rendered, the fence was still there,
 * and only the import lines were missing from the generated markdown. Code
 * segments are now masked before the strip runs.
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { processMarkdownFile } = require('../lib/processor');

async function setupTestFiles() {
  const siteDir = path.join(__dirname, 'test-code-fence-imports-temp');

  // Clean up if exists
  try {
    await fs.rm(siteDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }

  await fs.mkdir(path.join(siteDir, 'src', 'partials'), { recursive: true });
  await fs.mkdir(path.join(siteDir, 'docs'), { recursive: true });

  // A partial carrying its own component import (which must be stripped) and
  // code samples whose import lines must survive: a fenced block, a tilde
  // fence, and an inline span.
  const partialContent = `import Tabs from '@theme/Tabs';

Add the framework to your target:

\`\`\`swift
import Foundation
import UIKit

let session = URLSession.shared
\`\`\`

The Kotlin equivalent:

~~~kotlin
import kotlinx.coroutines.runBlocking

fun main() = runBlocking { }
~~~

Reference it inline as \`import Foundation\` when describing the sample.`;

  await fs.writeFile(
    path.join(siteDir, 'src', 'partials', 'adding-the-framework.mdx'),
    partialContent
  );

  const mainContent = `---
title: Adding the framework
description: How to add the framework
---

import PartialAddingTheFramework from '@site/src/partials/adding-the-framework.mdx';

# Adding the framework

<PartialAddingTheFramework />`;

  await fs.writeFile(path.join(siteDir, 'docs', 'adding.mdx'), mainContent);

  return siteDir;
}

async function runTest() {
  console.log('Testing code-fence imports inside partials...\n');

  const siteDir = await setupTestFiles();

  const originalCwd = process.cwd();
  process.chdir(os.tmpdir());

  try {
    const docPath = path.join(siteDir, 'docs', 'adding.mdx');
    const result = await processMarkdownFile(
      docPath,
      path.join(siteDir, 'docs'),
      'https://example.com',
      'docs',
      undefined,
      true, // excludeImports
      false, // removeDuplicateHeadings
      [], // preserveComponents
      undefined, // resolvedUrl
      undefined, // imageAssetMap
      undefined, // outDir
      siteDir // siteDir — used to resolve @site/ imports
    );

    let allTestsPassed = true;

    // Test 1: backtick-fenced sample keeps its import lines
    if (
      !result.content.includes('import Foundation') ||
      !result.content.includes('import UIKit')
    ) {
      console.log('❌ Test 1 failed: Swift import lines stripped from fenced code block');
      allTestsPassed = false;
    } else {
      console.log('✅ Test 1 passed: Swift import lines preserved in fenced code block');
    }

    // Test 2: tilde-fenced sample keeps its import line
    if (!result.content.includes('import kotlinx.coroutines.runBlocking')) {
      console.log('❌ Test 2 failed: Kotlin import line stripped from tilde fence');
      allTestsPassed = false;
    } else {
      console.log('✅ Test 2 passed: Kotlin import line preserved in tilde fence');
    }

    // Test 3: the partial's own component import is still removed
    if (/^\s*import Tabs from/m.test(result.content)) {
      console.log("❌ Test 3 failed: partial's own import line leaked into output");
      allTestsPassed = false;
    } else {
      console.log("✅ Test 3 passed: partial's component import still stripped");
    }

    // Test 4: surrounding prose survives
    if (!result.content.includes('Add the framework to your target')) {
      console.log('❌ Test 4 failed: partial prose missing from output');
      allTestsPassed = false;
    } else {
      console.log('✅ Test 4 passed: partial prose inlined');
    }

    // Test 5: the code fences themselves survive intact
    if (!result.content.includes('```swift') || !result.content.includes('~~~kotlin')) {
      console.log('❌ Test 5 failed: code fences lost from output');
      allTestsPassed = false;
    } else {
      console.log('✅ Test 5 passed: code fences intact');
    }

    if (!allTestsPassed) {
      process.exitCode = 1;
    } else {
      console.log('\nAll code-fence import tests passed!');
    }
  } finally {
    process.chdir(originalCwd);
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
