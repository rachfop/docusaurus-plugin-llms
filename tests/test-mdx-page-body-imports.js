/**
 * Tests for imported MDX page-body inlining (#65):
 * - Any .mdx/.md import is collected (no '_'/'/partials/' naming gate)
 * - Webpack-style aliases ('@global/components/x.mdx') resolve against siteDir
 * - Failed resolutions warn and leave well-formed (not empty) output
 *
 * Run with: node tests/test-mdx-page-body-imports.js
 */

const assert = require('assert');
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
  console.log('Testing imported MDX page-body inlining and alias resolution...\n');

  const siteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-alias-'));
  try {
    fs.mkdirSync(path.join(siteDir, 'global', 'components', 'release-notes'), { recursive: true });
    fs.writeFileSync(
      path.join(siteDir, 'global', 'components', 'release-notes', '1.20.0.mdx'),
      '## Features\n\nFaster builds everywhere.'
    );
    fs.mkdirSync(path.join(siteDir, 'docs', 'release-notes'), { recursive: true });
    fs.writeFileSync(
      path.join(siteDir, 'docs', 'release-notes', '1.20.0.mdx'),
      'The whole page body lives here.'
    );

    const pagePath = path.join(siteDir, 'docs', 'page.mdx');

    // 1. Plain-named page-body import is inlined (the #65 gate would skip it).
    {
      const input = [
        'import ReleaseNote from "./release-notes/1.20.0.mdx";',
        '',
        '# What\'s new',
        '',
        '<ReleaseNote/>',
      ].join('\n');
      const out = await resolvePartialImports(input, pagePath, new Set(), siteDir);
      expect('plain-named page body inlined', out.includes('The whole page body lives here.'), out);
      expect('import line removed', !out.includes('import ReleaseNote'), out);
      expect('jsx tag removed', !out.includes('<ReleaseNote'), out);
    }

    // 2. Alias import ('@global/...') resolves against siteDir.
    {
      const input = [
        'import ReleaseNote from "@global/components/release-notes/1.20.0.mdx";',
        '',
        '<ReleaseNote/>',
      ].join('\n');
      const out = await resolvePartialImports(input, pagePath, new Set(), siteDir);
      expect('alias-resolved body inlined', out.includes('Faster builds everywhere.'), out);
    }

    // 3. Nested content inside the aliased partial is preserved verbatim.
    {
      const out = await resolvePartialImports(
        'import RN from "@global/components/release-notes/1.20.0.mdx";\n\n<RN/>',
        pagePath,
        new Set(),
        siteDir
      );
      expect('heading from aliased partial kept', out.includes('## Features'), out);
    }

    // 4. Unresolvable alias: warns (not silent), removes import + tag cleanly.
    {
      const warnings = [];
      const origWarn = console.warn;
      const captured = console.warn = (...args) => warnings.push(args.join(' '));
      try {
        const input = [
          'import Missing from "@global/components/nope.mdx";',
          '',
          'Before.',
          '',
          '<Missing/>',
          '',
          'After.',
        ].join('\n');
        const out = await resolvePartialImports(input, pagePath, new Set(), siteDir);
        expect('failed alias: page survives with surrounding text',
          out.includes('Before.') && out.includes('After.'), out);
        expect('failed alias: import and tag removed',
          !out.includes('import Missing') && !out.includes('<Missing'), out);
        expect('failed alias: warning names the specifier',
          warnings.some(w => w.includes('@global/components/nope.mdx')),
          JSON.stringify(warnings));
        void captured;
      } finally {
        console.warn = origWarn;
      }
    }

    // 5. Underscore-prefixed partials still inline (no regression).
    {
      fs.mkdirSync(path.join(siteDir, 'docs', 'partials'), { recursive: true });
      fs.writeFileSync(path.join(siteDir, 'docs', 'partials', '_bit.mdx'), 'A partial bit.');
      const input = [
        'import Bit from "./partials/_bit.mdx";',
        '',
        '<Bit/>',
      ].join('\n');
      const out = await resolvePartialImports(input, pagePath, new Set(), siteDir);
      expect('underscore partial still inlined', out.includes('A partial bit.'), out);
    }

    // 6. @site alias still resolves (no regression).
    {
      fs.writeFileSync(path.join(siteDir, 'docs', '_via-site.mdx'), 'Via @site.');
      const input = [
        'import ViaSite from "@site/docs/_via-site.mdx";',
        '',
        '<ViaSite/>',
      ].join('\n');
      const out = await resolvePartialImports(input, pagePath, new Set(), siteDir);
      expect('@site alias still inlined', out.includes('Via @site.'), out);
    }

    // 7. Relative imports outside any alias still resolve against the file's dir.
    {
      const input = [
        'import Rel from "./_relative-note.mdx";',
        '',
        '<Rel/>',
      ].join('\n');
      fs.writeFileSync(path.join(siteDir, 'docs', '_relative-note.mdx'), 'Relative works.');
      const out = await resolvePartialImports(input, pagePath, new Set(), siteDir);
      expect('relative import still inlined', out.includes('Relative works.'), out);
    }
  } finally {
    fs.rmSync(siteDir, { recursive: true, force: true });
  }

  console.log(`\nPassed: ${passed}, Failed: ${failed}, Total: ${passed + failed}\n`);
  return failed === 0;
}

run()
  .then(ok => { console.log(ok ? '🎉 All page-body import tests passed!' : '❌ Some tests failed.'); process.exit(ok ? 0 : 1); })
  .catch(err => { console.error('Test execution error:', err); process.exit(1); });
