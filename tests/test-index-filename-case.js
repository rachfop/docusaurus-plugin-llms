/**
 * Integration tests: Docusaurus's directory-index filename convention is
 * case-insensitive and includes README, so the plugin must treat INDEX.md,
 * Index.md and README.md the same way it treats index.md.
 *
 * `isCategoryIndex` in @docusaurus/plugin-content-docs matches the file name
 * lowercased against "index", "readme" and the parent directory's name, and
 * routes such docs at the parent directory. The plugin stripped only a
 * lowercase "/index", so a page named INDEX.md failed to resolve against the
 * real route and silently fell back to the filename heuristic, emitting a URL
 * that 404s.
 *
 * Found on a real site: an Excel function reference page named INDEX.md was the
 * only broken link out of 7,359 generated pages.
 *
 * Run with: node tests/test-index-filename-case.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const plugin = require('../lib/index').default;

console.log('Testing case-insensitive index/readme filename handling...\n');

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

function page(title, body) {
  return `---\ntitle: ${title}\ndescription: ${title} page.\n---\n\n# ${title}\n\n${body}`;
}

function makeMockContext(tmpDir, outDir) {
  return {
    siteDir: tmpDir,
    siteConfig: {
      title: 'Test Site',
      tagline: 'Testing index filename case',
      url: 'https://example.com',
      baseUrl: '/',
    },
    outDir,
  };
}

function makeSite() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-llms-index-case-'));
  const outDir = path.join(tmpDir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  return { tmpDir, outDir };
}

function cleanup(tmpDir) {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}

/**
 * Write a single doc at docs/guide/<fileName> and generate llms.txt against a
 * site whose only route is /guide — i.e. Docusaurus routed that doc at its
 * parent directory, per the index convention.
 */
async function generateWithIndexFile(fileName) {
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'guide'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guide', fileName),
      page('Guide', 'Guide body.')
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      docsDir: [{ path: 'docs', routeBasePath: '/' }],
    });
    await p.postBuild({ routesPaths: ['/guide'] });

    return { llms: fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8'), tmpDir };
  } catch (err) {
    cleanup(tmpDir);
    throw err;
  }
}

async function testIndexFileName(fileName) {
  const name = `${fileName} resolves to its parent directory route`;
  let tmpDir;
  try {
    const result = await generateWithIndexFile(fileName);
    tmpDir = result.tmpDir;
    const { llms } = result;

    assert.ok(
      llms.includes('](https://example.com/guide)'),
      `expected a link to /guide; got:\n${llms}`
    );
    // The pre-fix failure mode: the filename is carried into the URL.
    assert.ok(
      !/\/guide\/(index|readme)/i.test(llms),
      `URL should not retain the ${fileName} segment; got:\n${llms}`
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    if (tmpDir) cleanup(tmpDir);
  }
}

// A non-index file in the same position must keep its own segment — the
// stripping is anchored to the end and must not fire on unrelated names.
async function testNonIndexFileKeepsItsSegment() {
  const name = 'a non-index file name is not collapsed';
  const { tmpDir, outDir } = makeSite();
  try {
    fs.mkdirSync(path.join(tmpDir, 'docs', 'guide'), { recursive: true });
    // "indexing" ends with neither "/index" nor "/readme" as a whole segment.
    fs.writeFileSync(
      path.join(tmpDir, 'docs', 'guide', 'indexing.md'),
      page('Indexing', 'Indexing body.')
    );

    const p = plugin(makeMockContext(tmpDir, outDir), {
      generateLLMsFullTxt: false,
      docsDir: [{ path: 'docs', routeBasePath: '/' }],
    });
    await p.postBuild({ routesPaths: ['/guide/indexing'] });

    const llms = fs.readFileSync(path.join(outDir, 'llms.txt'), 'utf8');
    assert.ok(
      llms.includes('https://example.com/guide/indexing'),
      `expected /guide/indexing to survive intact; got:\n${llms}`
    );

    pass(name);
  } catch (err) {
    fail(name, err.message);
  } finally {
    cleanup(tmpDir);
  }
}

async function run() {
  // Regression guard: lowercase index.md already worked and must keep working.
  await testIndexFileName('index.md');
  // The bug: these were not recognised as directory indices.
  await testIndexFileName('INDEX.md');
  await testIndexFileName('Index.md');
  await testIndexFileName('README.md');
  await testIndexFileName('readme.md');

  await testNonIndexFileKeepsItsSegment();

  console.log(`\n${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) process.exit(1);
}

run();
