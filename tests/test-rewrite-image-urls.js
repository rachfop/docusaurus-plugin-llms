/**
 * Test suite for buildImageAssetMap and rewriteRelativeImageUrls
 *
 * Covers:
 * - Scanning build/assets/images/ and stripping hash suffixes
 * - Rewriting ./img/, ../img/, ../../img/ to absolute URLs
 * - Byte-comparison disambiguation when multiple images share a basename
 * - Graceful no-op for unknown images or non-existent asset directory
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

const { buildImageAssetMap, rewriteRelativeImageUrls } = require('../lib/utils');

async function setupBuildDir() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'llms-img-test-'));
  const imagesDir = path.join(root, 'assets', 'images');
  await fs.mkdir(imagesDir, { recursive: true });
  return { root, imagesDir };
}

async function runTests() {
  console.log('Running rewriteImageUrls tests...\n');
  let allTestsPassed = true;
  const tempDirs = [];

  // buildImageAssetMap

  // Test 1: strips hash suffix and maps to site-root relative path
  console.log('Test 1: buildImageAssetMap — strips hash suffix');
  {
    const { root, imagesDir } = await setupBuildDir();
    tempDirs.push(root);
    await fs.writeFile(path.join(imagesDir, 'diagram-abc123def456789a.png'), 'data');
    const map = await buildImageAssetMap(root);
    const val = map.get('diagram.png');
    if (val && val.length === 1 && val[0] === '/assets/images/diagram-abc123def456789a.png') {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: got ${JSON.stringify(val)}\n`);
      allTestsPassed = false;
    }
  }

  // Test 2: files without hash suffix are kept as-is
  console.log('Test 2: buildImageAssetMap — no-hash file kept as-is');
  {
    const { root, imagesDir } = await setupBuildDir();
    tempDirs.push(root);
    await fs.writeFile(path.join(imagesDir, 'logo.svg'), 'svg');
    const map = await buildImageAssetMap(root);
    const val = map.get('logo.svg');
    if (val && val.length === 1 && val[0] === '/assets/images/logo.svg') {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: got ${JSON.stringify(val)}\n`);
      allTestsPassed = false;
    }
  }

  // Test 3: multiple files with same basename → list of candidates
  console.log('Test 3: buildImageAssetMap — collision builds candidate list');
  {
    const { root, imagesDir } = await setupBuildDir();
    tempDirs.push(root);
    await fs.writeFile(path.join(imagesDir, 'icon-aaaa1111bbbb2222.png'), 'v1');
    await fs.writeFile(path.join(imagesDir, 'icon-cccc3333dddd4444.png'), 'v2');
    const map = await buildImageAssetMap(root);
    const val = map.get('icon.png');
    if (val && val.length === 2) {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: expected 2 candidates, got ${JSON.stringify(val)}\n`);
      allTestsPassed = false;
    }
  }

  // Test 4: missing assets directory returns empty map without throwing
  console.log('Test 4: buildImageAssetMap — missing dir returns empty map');
  {
    const map = await buildImageAssetMap('/definitely/does/not/exist');
    if (map.size === 0) {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: expected empty map, got size ${map.size}\n`);
      allTestsPassed = false;
    }
  }

  // rewriteRelativeImageUrls

  // Helper: build a minimal in-memory map without touching the filesystem
  function makeMap(basename, hashedPath) {
    return new Map([[basename, [hashedPath]]]);
  }

  const siteUrl = 'https://example.com';
  // A plausible source file path (the file need not exist for single-candidate cases)
  const srcFile = path.join(os.tmpdir(), 'docs', 'guide', 'intro.md');

  // Test 5: ./img/ path rewritten
  console.log('Test 5: rewriteRelativeImageUrls — ./img/ path');
  {
    const map = makeMap('diagram.png', '/assets/images/diagram-abc123.png');
    const input = '![A diagram](./img/diagram.png)';
    const out = await rewriteRelativeImageUrls(input, srcFile, map, siteUrl, '/fake/build');
    if (out === '![A diagram](https://example.com/assets/images/diagram-abc123.png)') {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Test 6: ../img/ path rewritten
  console.log('Test 6: rewriteRelativeImageUrls — ../img/ path');
  {
    const map = makeMap('screen.png', '/assets/images/screen-def456.png');
    const input = '![Screen](../img/screen.png)';
    const out = await rewriteRelativeImageUrls(input, srcFile, map, siteUrl, '/fake/build');
    if (out === '![Screen](https://example.com/assets/images/screen-def456.png)') {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Test 7: ../../img/ path rewritten
  console.log('Test 7: rewriteRelativeImageUrls — ../../img/ path');
  {
    const deepSrc = path.join(os.tmpdir(), 'docs', 'a', 'b', 'page.md');
    const map = makeMap('chart.png', '/assets/images/chart-ghi789.png');
    const input = '![Chart](../../img/chart.png)';
    const out = await rewriteRelativeImageUrls(input, deepSrc, map, siteUrl, '/fake/build');
    if (out === '![Chart](https://example.com/assets/images/chart-ghi789.png)') {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Test 8: unknown image (not in map) is left unchanged
  console.log('Test 8: rewriteRelativeImageUrls — unknown image unchanged');
  {
    const map = new Map(); // empty
    const input = '![Missing](./img/ghost.png)';
    const out = await rewriteRelativeImageUrls(input, srcFile, map, siteUrl, '/fake/build');
    if (out === input) {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: expected unchanged, got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Test 9: content without any images is returned unchanged
  console.log('Test 9: rewriteRelativeImageUrls — no images, unchanged');
  {
    const map = makeMap('diagram.png', '/assets/images/diagram-abc123.png');
    const input = 'Just plain text with no images.';
    const out = await rewriteRelativeImageUrls(input, srcFile, map, siteUrl, '/fake/build');
    if (out === input) {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: expected unchanged, got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Test 10: absolute URL images are not touched
  console.log('Test 10: rewriteRelativeImageUrls — absolute URLs unchanged');
  {
    const map = makeMap('diagram.png', '/assets/images/diagram-abc123.png');
    const input = '![Already absolute](https://cdn.example.com/img/diagram.png)';
    const out = await rewriteRelativeImageUrls(input, srcFile, map, siteUrl, '/fake/build');
    if (out === input) {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: expected unchanged, got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Test 11: multiple images in one document — all rewritten
  console.log('Test 11: rewriteRelativeImageUrls — multiple images in one doc');
  {
    const map = new Map([
      ['foo.png', ['/assets/images/foo-111.png']],
      ['bar.jpg', ['/assets/images/bar-222.jpg']],
    ]);
    const input = '![Foo](./img/foo.png)\n\nSome text\n\n![Bar](../img/bar.jpg)';
    const expected = '![Foo](https://example.com/assets/images/foo-111.png)\n\nSome text\n\n![Bar](https://example.com/assets/images/bar-222.jpg)';
    const out = await rewriteRelativeImageUrls(input, srcFile, map, siteUrl, '/fake/build');
    if (out === expected) {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Test 12: byte-comparison selects the correct candidate
  console.log('Test 12: rewriteRelativeImageUrls — byte comparison (multi-candidate)');
  {
    const { root, imagesDir } = await setupBuildDir();
    tempDirs.push(root);

    // Create two distinct images in the build dir with same basename
    const bytes1 = Buffer.from('IMAGE_CONTENT_VERSION_1');
    const bytes2 = Buffer.from('IMAGE_CONTENT_VERSION_2');
    await fs.writeFile(path.join(imagesDir, 'shot-aaaa1111bbbb2222cccc3333.png'), bytes1);
    await fs.writeFile(path.join(imagesDir, 'shot-dddd4444eeee5555ffff6666.png'), bytes2);

    // Create a "source" image that matches bytes2
    const srcImgDir = path.join(root, 'docs', 'img');
    await fs.mkdir(srcImgDir, { recursive: true });
    await fs.writeFile(path.join(srcImgDir, 'shot.png'), bytes2);

    const map = await buildImageAssetMap(root);
    const sourceMd = path.join(root, 'docs', 'page.md');
    const input = '![Shot](./img/shot.png)';
    const out = await rewriteRelativeImageUrls(input, sourceMd, map, siteUrl, root);

    if (out === '![Shot](https://example.com/assets/images/shot-dddd4444eeee5555ffff6666.png)') {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Test 13: trailing slash on siteUrl is stripped
  console.log('Test 13: rewriteRelativeImageUrls — trailing slash on siteUrl stripped');
  {
    const map = makeMap('logo.png', '/assets/images/logo-abc.png');
    const input = '![Logo](./img/logo.png)';
    const out = await rewriteRelativeImageUrls(input, srcFile, map, 'https://example.com/', '/fake/build');
    if (out === '![Logo](https://example.com/assets/images/logo-abc.png)') {
      console.log('  ✅ PASS\n');
    } else {
      console.log(`  ❌ FAIL: got "${out}"\n`);
      allTestsPassed = false;
    }
  }

  // Cleanup
  for (const dir of tempDirs) {
    try { await fs.rm(dir, { recursive: true }); } catch { /* ignore */ }
  }

  // Summary
  if (allTestsPassed) {
    console.log('Results: All rewriteImageUrls tests passed.');
    console.log('🎉 Image URL rewriting works correctly!');
  } else {
    console.log('Results: Some tests failed.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
