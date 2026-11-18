/**
 * Integration test for issue #98: a page whose frontmatter slug ends in `.md`
 * (`slug: fiber.md`) is routed by Docusaurus at `/guide/fiber.md` and written
 * to the directory `build/guide/fiber.md/`. The plugin's Markdown copy of that
 * page has to go beside the directory, as `guide/fiber.md.md` (what 0.6.0
 * wrote), not into it: writing `guide/fiber.md` fails with EISDIR, and that
 * error aborts the whole generation step, so no llms.txt or llms-full.txt is
 * written while the Docusaurus build still exits 0.
 *
 * Run with: node tests/test-md-slug-route.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const plugin = require('../lib/index').default;

console.log('Testing a page slug that ends in .md (#98)...\n');

let passedTests = 0;
let failedTests = 0;

function pass(name) {
  console.log(`  PASS: ${name}`);
  passedTests++;
}

function fail(name, reason) {
  console.log(`  FAIL: ${name}`);
  console.log(`     ${reason}`);
  failedTests++;
}

function page(title, body, frontMatter = {}) {
  const fm = Object.entries(frontMatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n');
  const header = fm ? `${fm}\n` : '';
  return `---\ntitle: ${title}\ndescription: ${title} page.\n${header}---\n\n# ${title}\n\n${body}`;
}

function makeSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-md-slug-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(path.join(tmpDir, 'docs', 'guide'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'intro.md'),
    page('Intro', 'Intro body.', { id: 'intro' }),
  );
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'guide', 'fiber.md'),
    page('Fiber', 'Fiber body.', { id: 'fiber', slug: 'fiber.md' }),
  );
  // What Docusaurus itself builds for these routes: a directory per page
  // holding its index.html, so `out/guide/fiber.md` is a directory.
  for (const route of ['intro', 'guide/fiber.md']) {
    fs.mkdirSync(path.join(outDir, route), { recursive: true });
    fs.writeFileSync(path.join(outDir, route, 'index.html'), '<html></html>');
  }
  return { tmpDir, outDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

async function testMdSlugRoute() {
  const name =
    'slug: fiber.md writes guide/fiber.md.md, and llms.txt and llms-full.txt are written';
  const { tmpDir, outDir } = makeSite();
  // The plugin logs a failed generation step instead of throwing, so collect
  // what it logged to show in the failure message.
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  try {
    const p = plugin(
      {
        siteDir: tmpDir,
        siteConfig: { title: 'Test Site', tagline: 'T', url: 'https://example.com', baseUrl: '/' },
        outDir,
      },
      {
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        generateMarkdownFiles: true,
        // Docs served at the site root, as in the report (routeBasePath '/').
        docsDir: [{ path: 'docs', routeBasePath: '/' }],
      },
    );
    await p.postBuild({ routesPaths: ['/intro', '/guide/fiber.md'] });
    console.error = originalError;

    assert.ok(
      fs.existsSync(path.join(outDir, 'llms.txt')),
      `llms.txt was not written; plugin errors: ${errors.join(' | ') || 'none'}`,
    );
    assert.ok(
      fs.existsSync(path.join(outDir, 'llms-full.txt')),
      `llms-full.txt was not written; plugin errors: ${errors.join(' | ') || 'none'}`,
    );

    const copy = path.join(outDir, 'guide', 'fiber.md.md');
    assert.ok(
      fs.existsSync(copy) && fs.statSync(copy).isFile(),
      'the Markdown copy should be the file guide/fiber.md.md, beside the route directory',
    );
    assert.ok(
      fs.statSync(path.join(outDir, 'guide', 'fiber.md')).isDirectory() &&
        fs.existsSync(path.join(outDir, 'guide', 'fiber.md', 'index.html')),
      'the Docusaurus route directory guide/fiber.md/ must be left as it is',
    );

    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    assert.ok(
      llms.includes('(https://example.com/guide/fiber.md.md)'),
      `llms.txt should link the copy at /guide/fiber.md.md; got:\n${llms}`,
    );
    assert.ok(
      llms.includes('(https://example.com/intro.md)'),
      `llms.txt should still link the other page at /intro.md; got:\n${llms}`,
    );
    assert.strictEqual(errors.length, 0, `the plugin logged errors: ${errors.join(' | ')}`);

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    console.error = originalError;
    cleanup(tmpDir);
  }
}

async function main() {
  await testMdSlugRoute();

  console.log('\n' + '='.repeat(50));
  console.log(
    `Test Results: ${passedTests}/${passedTests + failedTests} passed, ${failedTests} failed`,
  );
  console.log('='.repeat(50));

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
