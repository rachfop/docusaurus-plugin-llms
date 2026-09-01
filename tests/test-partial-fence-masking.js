/**
 * Regression tests: partial-import resolution must ignore imports inside
 * fenced code blocks and inline code spans.
 *
 * The docs promise that an import line shown inside a code sample stays
 * exactly as written. resolvePartialImports used to scan the raw document, so
 * a fenced import was treated as real: a resolvable path spliced the
 * partial's content into the code sample, and a missing path logged an
 * ENOENT warning (observed on the plugin's own dogfooded docs build, where
 * the partials page shows an example import in a fence).
 *
 * The pipeline now masks code segments before partial resolution and
 * restores them after, so only imports outside fences are treated as real.
 *
 * Run with: node tests/test-partial-fence-masking.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { maskCodeSegments, resolvePartialImports } = require('../lib/utils');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${detail}`); failed++; }
}

async function resolve(content, filePath, siteDir) {
  const { masked, restore } = maskCodeSegments(content);
  return restore(await resolvePartialImports(masked, filePath, new Set(), siteDir));
}

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-fence-'));
  // A real partial on disk so resolvable paths are possible.
  fs.writeFileSync(path.join(dir, '_demo.mdx'), '## Real Partial\n\nInjected content.\n');

  console.log('Testing partial resolution ignores code fences...\n');

  // 1. Fenced import, target exists: fence must stay verbatim.
  {
    const src = '# Page\n\n```mdx\nimport Demo from "./_demo.mdx";\n\n<Demo />\n\nBody.\n```\n';
    const out = await resolve(src, path.join(dir, 'page.mdx'), dir);
    expect('fenced import left as written', out.includes('import Demo from "./_demo.mdx";'), out);
    expect('no content spliced into fence', !out.includes('Injected content'), out);
  }

  // 2. Fenced import, target missing: no resolution attempt, no injection.
  {
    const src = '# Page\n\n```mdx\nimport Missing from "./_missing.mdx";\n```\n';
    const out = await resolve(src, path.join(dir, 'page.mdx'), dir);
    expect('missing-target fence untouched', out.includes('import Missing'), out);
  }

  // 3. Inline-code import stays as written.
  {
    const src = '# Page\n\nUse `import X from "./_demo.mdx";` inline.\n';
    const out = await resolve(src, path.join(dir, 'page.mdx'), dir);
    expect('inline-code import untouched', out.includes('import X from'), out);
    expect('no splice from inline code', !out.includes('Injected content'), out);
  }

  // 4. Real import outside any fence still resolves and inlines.
  {
    const src = '# Page\n\nimport Demo from "./_demo.mdx";\n\n<Demo />\n\nBody.\n';
    const out = await resolve(src, path.join(dir, 'real.mdx'), dir);
    expect('real import resolved', out.includes('Injected content'), out);
    expect('real import line removed', !out.includes('import Demo'), out);
  }

  // 5. Mixed: real import in prose plus fenced import of the same partial.
  {
    const src = '# Page\n\nimport Demo from "./_demo.mdx";\n\n<Demo />\n\n```mdx\nimport Demo from "./_demo.mdx";\n```\n';
    const out = await resolve(src, path.join(dir, 'mixed.mdx'), dir);
    expect('prose import resolved', /Injected content/.test(out), out);
    expect('fenced copy still verbatim', /```mdx\nimport Demo/.test(out), out);
  }

  // 6. Tilde fences are masked too.
  {
    const src = '# Page\n\n~~~mdx\nimport Demo from "./_demo.mdx";\n~~~\n';
    const out = await resolve(src, path.join(dir, 'tilde.mdx'), dir);
    expect('tilde-fenced import untouched', out.includes('~~~mdx\nimport Demo'), out);
    expect('no splice through tilde fence', !out.includes('Injected content'), out);
  }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

const ok = run().then((r) => {
  console.log(r ? '🎉 All partial-fence masking tests passed!' : '❌ Some tests failed.');
  process.exit(r ? 0 : 1);
});
