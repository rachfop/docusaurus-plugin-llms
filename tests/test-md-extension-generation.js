/**
 * Integration test for issue #41: `.md` must only be appended to llms.txt links
 * when the individual markdown files are actually generated. Otherwise the links
 * point to files that don't exist in the build output and return 404.
 *
 * Run with: node tests/test-md-extension-generation.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const plugin = require('../lib/index').default;

console.log('Testing .md extension / file-generation coupling (#41)...\n');

let passed = 0;
let failed = 0;

function createTempSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-md-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'getting-started.md'),
    '---\ntitle: Getting Started\ndescription: Start here.\n---\n\n# Getting Started\n\nStart here.'
  );
  return { tmpDir, outDir };
}

function mockContext(tmpDir, outDir) {
  return {
    siteDir: tmpDir,
    siteConfig: { title: 'Test', tagline: 'T', url: 'https://example.com', baseUrl: '/' },
    outDir,
  };
}

async function run() {
  // Case 1: default (addMdExtension true, generateMarkdownFiles false) → no .md, no files
  {
    const name = 'default: links have no .md and no markdown files are written';
    const { tmpDir, outDir } = createTempSite();
    try {
      await plugin(mockContext(tmpDir, outDir), {
        generateLLMsFullTxt: false,
        llmsTxtFilename: 'llms.txt',
      }).postBuild();
      const content = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
      assert.ok(content.includes('(https://example.com/docs/getting-started)'), `expected plain route link, got:\n${content}`);
      assert.ok(!content.includes('getting-started.md'), `link should not have .md, got:\n${content}`);
      assert.ok(!fs.existsSync(path.join(outDir, 'docs', 'getting-started.md')), 'no .md file should be generated');
      console.log(`  ✅ PASS: ${name}`); passed++;
    } catch (err) {
      console.log(`  ❌ FAIL: ${name}\n     ${err.message}`); failed++;
    } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  }

  // Case 2: generateMarkdownFiles true → .md links AND the files exist
  {
    const name = 'generateMarkdownFiles: links have .md and the files are written';
    const { tmpDir, outDir } = createTempSite();
    try {
      await plugin(mockContext(tmpDir, outDir), {
        generateLLMsFullTxt: false,
        generateMarkdownFiles: true,
        llmsTxtFilename: 'llms.txt',
      }).postBuild();
      const content = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
      assert.ok(content.includes('(https://example.com/docs/getting-started.md)'), `expected .md link, got:\n${content}`);
      assert.ok(fs.existsSync(path.join(outDir, 'docs', 'getting-started.md')), 'the .md file should be generated');
      console.log(`  ✅ PASS: ${name}`); passed++;
    } catch (err) {
      console.log(`  ❌ FAIL: ${name}\n     ${err.message}`); failed++;
    } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  }

  // Case 3: explicit addMdExtension:false with generation off → still no .md (unchanged)
  {
    const name = 'addMdExtension:false keeps plain routes';
    const { tmpDir, outDir } = createTempSite();
    try {
      await plugin(mockContext(tmpDir, outDir), {
        generateLLMsFullTxt: false,
        addMdExtension: false,
        llmsTxtFilename: 'llms.txt',
      }).postBuild();
      const content = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
      assert.ok(!content.includes('getting-started.md'), `link should not have .md, got:\n${content}`);
      console.log(`  ✅ PASS: ${name}`); passed++;
    } catch (err) {
      console.log(`  ❌ FAIL: ${name}\n     ${err.message}`); failed++;
    } finally { fs.rmSync(tmpDir, { recursive: true, force: true }); }
  }

  console.log(`\n========================================`);
  console.log(`.md Extension Coupling Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);
  return failed === 0;
}

run()
  .then(ok => {
    console.log(ok ? '🎉 All .md extension coupling tests passed!' : '❌ Some tests failed.');
    process.exit(ok ? 0 : 1);
  })
  .catch(err => {
    console.error('Test execution error:', err);
    process.exit(1);
  });
