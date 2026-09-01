/**
 * Tests for $-sequence safety when inlining partial content (#audit finding 1).
 *
 * resolvePartialImports splices partial content via String.replace. A string
 * replacement interprets $&, $', $`, $$, $1.. as replacement patterns; a
 * partial containing `echo $1` or `kill $$` in a code sample would be
 * corrupted. The splice must use a function replacement.
 *
 * Run with: node tests/test-partial-dollar-replacement.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolvePartialImports } = require('../lib/utils');

let passed = 0;
let failed = 0;
function expect(name, cond, detail) {
  if (cond) { console.log(`  ✅ PASS: ${name}`); passed++; }
  else { console.log(`  ❌ FAIL: ${name}\n     ${detail}`); failed++; }
}

async function run() {
  console.log('Testing $-sequence safety in partial inlining...\n');

  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-dollar-'));
  try {
    // A partial full of $ patterns, exactly what shell/perl docs contain.
    fs.mkdirSync(path.join(siteDir, 'docs', 'partials'), { recursive: true });
    const samples = [
      'echo $1 and $2',
      'kill $$',
      'perl -pe "s/x/y/$&/g" gives $$ $` $\' $\'',
      'cost is 5$$ today',
    ].join('\n');
    fs.writeFileSync(
      path.join(siteDir, 'docs', 'partials', '_shell.mdx'),
      '```bash\n' + samples + '\n```'
    );

    const pagePath = path.join(siteDir, 'docs', 'page.mdx');
    const input = [
      'import Shell from "./partials/_shell.mdx";',
      '',
      'Intro line.',
      '',
      '<Shell attr1="value1" attr2="value2" />',
      '',
      'Outro line.',
    ].join('\n');
    const out = await resolvePartialImports(input, pagePath, new Set(), siteDir);

    // 1. Every $ pattern must survive verbatim.
    expect('$1/$2 survive', out.includes('echo $1 and $2'), out);
    expect('$$ survives', out.includes('kill $$'), out);
    expect('$& survives', out.includes('$&'), out);
    expect("$' survives", out.includes("$'"), out);
    expect('fenced block intact', out.includes('```bash'), out);

    // 2. $1 must NOT be substituted with the tag's attribute value.
    expect('no attr substitution into $1', !out.includes('value1'), out);

    // 3. $& must NOT re-insert the JSX tag.
    expect('no tag re-insertion', !out.includes('<Shell'), out);

    // 4. $\' / $` must not splice in surrounding document text duplicately.
    expect('no document duplication', (out.match(/Intro line\./g) || []).length === 1, out);
    expect('no outro duplication', (out.match(/Outro line\./g) || []).length === 1, out);

    // 5. Structure: import line removed, body lines present.
    expect('import removed', !out.includes('import Shell'), out);
    expect('body text present', out.includes('Intro line.'), out);
  } finally {
    fs.rmSync(siteDir, { recursive: true, force: true });
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

run()
  .then(ok => { console.log(ok ? '🎉 All $-replacement tests passed!' : '❌ Some tests failed.'); process.exit(ok ? 0 : 1); })
  .catch(err => { console.error('Test execution error:', err); process.exit(1); });
