/**
 * Integration tests for review-fix regressions:
 *  - global `version` option now renders in llms.txt (was silently dropped)
 *  - `draft: "true"` (quoted string) is skipped like boolean true
 *
 * Run with: node tests/test-regression-fixes.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const plugin = require('../lib/index').default;

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${detail}`); failed++; }
}

function tempSite(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-reg-'));
  const outDir = path.join(dir, 'out');
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, 'docs', name), content);
  }
  return { dir, outDir };
}
const ctx = (dir, outDir) => ({
  siteDir: dir,
  siteConfig: { title: 'T', tagline: 'tag', url: 'https://x.dev', baseUrl: '/' },
  outDir,
});

async function run() {
  console.log('Testing review-fix regressions...\n');

  // 1. Global version renders in llms.txt
  {
    const { dir, outDir } = tempSite({ 'a.md': '---\ntitle: A\n---\n# A\n\nBody.' });
    try {
      await plugin(ctx(dir, outDir), { generateLLMsFullTxt: false, version: '1.2.3' }).postBuild();
      const content = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
      expect('global version appears in llms.txt', content.includes('Version: 1.2.3'), content);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }

  // 2. draft: "true" (string) is skipped
  {
    const { dir, outDir } = tempSite({
      'keep.md': '---\ntitle: Keep\n---\n# Keep\n\nBody.',
      'skip.md': '---\ntitle: Skip\ndraft: "true"\n---\n# Skip\n\nBody.',
    });
    try {
      await plugin(ctx(dir, outDir), { generateLLMsFullTxt: false }).postBuild();
      const content = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
      expect('non-draft doc kept', content.includes('Keep'), content);
      expect('draft:"true" string doc skipped', !content.includes('](https://x.dev/docs/skip'), content);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

run()
  .then(ok => { console.log(ok ? '🎉 All regression-fix tests passed!' : '❌ Some tests failed.'); process.exit(ok ? 0 : 1); })
  .catch(err => { console.error('Test execution error:', err); process.exit(1); });
