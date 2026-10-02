/**
 * Test route resolution helper functions
 *
 * Tests suffix-based URL resolution using routesPaths.
 */

const path = require('path');
const fs = require('fs-extra');
const { processFilesWithPatterns } = require('../lib/processor');

const TEST_DIR = path.join(__dirname, 'route-helpers-test');
const DOCS_DIR = path.join(TEST_DIR, 'docs');

async function setupTestFiles() {
  await fs.ensureDir(DOCS_DIR);

  await fs.writeFile(path.join(DOCS_DIR, 'simple.md'), '# Simple\n\nSimple test file.');

  await fs.writeFile(path.join(DOCS_DIR, '01-numbered.md'), '# Numbered\n\nNumbered prefix file.');

  await fs.writeFile(path.join(DOCS_DIR, '02-another.md'), '# Another\n\nAnother numbered file.');

  await fs.ensureDir(path.join(DOCS_DIR, '01-category'));
  await fs.writeFile(
    path.join(DOCS_DIR, '01-category', 'nested.md'),
    '# Nested\n\nNested file in numbered category.',
  );

  await fs.writeFile(
    path.join(DOCS_DIR, '01-category', '01-double.md'),
    '# Double\n\nDouble numbered file.',
  );
}

async function cleanupTestFiles() {
  await fs.remove(TEST_DIR);
}

async function runTests() {
  console.log('Testing route resolution helper functions...\n');

  try {
    await setupTestFiles();

    // Test 1: Suffix-based matching via routesPaths
    console.log('Test 1: Suffix-based route matching');
    {
      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/simple', '/numbered'],
      };

      const allFiles = [path.join(DOCS_DIR, 'simple.md'), path.join(DOCS_DIR, '01-numbered.md')];

      const results = await processFilesWithPatterns(context, allFiles);

      const simpleDoc = results.find((doc) => doc.path === 'docs/simple.md');
      const numberedDoc = results.find((doc) => doc.path === 'docs/01-numbered.md');

      if (simpleDoc && simpleDoc.url === 'https://example.com/simple') {
        console.log('  ✓ PASS: Suffix match for simple.md');
      } else {
        console.log('  ✗ FAIL: Expected simple.md to resolve to /simple');
        console.log(`    Got: ${simpleDoc?.url}`);
      }

      if (numberedDoc && numberedDoc.url === 'https://example.com/numbered') {
        console.log('  ✓ PASS: Suffix match for numbered file (prefix stripped)');
      } else {
        console.log('  ✗ FAIL: Expected 01-numbered.md to resolve to /numbered');
        console.log(`    Got: ${numberedDoc?.url}`);
      }
    }

    // Test 2: Numbered prefix removal via routesPaths
    console.log('\nTest 2: Numbered prefix removal');
    {
      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/another'],
      };

      const allFiles = [path.join(DOCS_DIR, '02-another.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/another') {
        console.log('  ✓ PASS: Numbered prefix stripped and matched');
      } else {
        console.log('  ✗ FAIL: Expected 02-another.md to resolve to /another');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 3: Nested folders with numbered prefixes
    console.log('\nTest 3: Nested folders with numbered prefixes');
    {
      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/category/nested'],
      };

      const allFiles = [path.join(DOCS_DIR, '01-category', 'nested.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/category/nested') {
        console.log('  ✓ PASS: Nested numbered prefix stripped and matched');
      } else {
        console.log('  ✗ FAIL: Expected nested file to resolve to /category/nested');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 4: Double numbered prefixes
    console.log('\nTest 4: Double numbered prefixes');
    {
      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/category/double'],
      };

      const allFiles = [path.join(DOCS_DIR, '01-category', '01-double.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/category/double') {
        console.log('  ✓ PASS: Double numbered prefixes handled correctly');
      } else {
        console.log('  ✗ FAIL: Expected double numbered file to resolve correctly');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 5: Fallback when no routesPaths exist
    console.log('\nTest 5: Fallback when no routesPaths exist');
    {
      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
      };

      const allFiles = [path.join(DOCS_DIR, 'simple.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/docs/simple') {
        console.log('  ✓ PASS: Fallback URL construction works');
      } else {
        console.log('  ✗ FAIL: Expected fallback URL to be /docs/simple');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 6: Versioned routes — shortest match preferred
    console.log('\nTest 6: Shortest route match preferred (stable over versioned)');
    {
      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/another', '/nightly/another'],
      };

      const allFiles = [path.join(DOCS_DIR, '02-another.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/another') {
        console.log('  ✓ PASS: Shortest route (stable) preferred over versioned');
      } else {
        console.log('  ✗ FAIL: Expected shortest match /another');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 7: Issue #31 — docsDir stripping prevents doubled paths
    // When routeBasePath is '/', Docusaurus routes are /manual/get-started
    // (not /docs/manual/get-started). Without docsDir stripping the tail
    // would be "docs/manual/get-started" and fall through to the fallback,
    // producing the doubled /docs/docs/manual/get-started URL.
    console.log('\nTest 7: Issue #31 — docsDir stripping prevents docs/docs doubling');
    {
      await fs.ensureDir(path.join(DOCS_DIR, 'manual'));
      await fs.writeFile(
        path.join(DOCS_DIR, 'manual', 'get-started.md'),
        '# Get Started\n\nGet started guide.',
      );

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/manual/get-started'],
      };

      const allFiles = [path.join(DOCS_DIR, 'manual', 'get-started.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/manual/get-started') {
        console.log('  ✓ PASS: No docs/docs doubling — resolved to /manual/get-started');
      } else {
        console.log('  ✗ FAIL: Expected /manual/get-started (not /docs/docs/manual/get-started)');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 8: Issue #30 — trailing-slash routes resolve correctly
    console.log('\nTest 8: Issue #30 — trailing-slash routes produce correct URLs');
    {
      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/simple/'],
      };

      const allFiles = [path.join(DOCS_DIR, 'simple.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/simple/') {
        console.log('  ✓ PASS: Trailing-slash route matched and URL preserved');
      } else {
        console.log('  ✗ FAIL: Expected URL with trailing slash /simple/');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 9: Directory collapsing (generics/generics.md -> /generics)
    console.log('\nTest 9: Directory collapsing — dir/dir.md resolves to /dir');
    {
      await fs.ensureDir(path.join(DOCS_DIR, 'generics'));
      await fs.writeFile(
        path.join(DOCS_DIR, 'generics', 'generics.md'),
        '# Generics\n\nGenerics documentation.',
      );

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/generics'],
      };

      const allFiles = [path.join(DOCS_DIR, 'generics', 'generics.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/generics') {
        console.log('  ✓ PASS: generics/generics.md collapsed to /generics');
      } else {
        console.log('  ✗ FAIL: Expected /generics (not /generics/generics)');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 10: Frontmatter id override — filename differs from route
    console.log('\nTest 10: Frontmatter id override resolves correct route');
    {
      await fs.writeFile(
        path.join(DOCS_DIR, 'python_to_mojo.md'),
        '---\nid: python-to-mojo\n---\n# Python to Mojo\n\nMigration guide.',
      );

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/python-to-mojo'],
      };

      const allFiles = [path.join(DOCS_DIR, 'python_to_mojo.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/python-to-mojo') {
        console.log('  ✓ PASS: Frontmatter id override resolved to /python-to-mojo');
      } else {
        console.log('  ✗ FAIL: Expected /python-to-mojo via frontmatter id override');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    // Test 11: Frontmatter slug override
    console.log('\nTest 11: Frontmatter slug override resolves correct route');
    {
      await fs.writeFile(
        path.join(DOCS_DIR, 'intro.md'),
        '---\nslug: /welcome\n---\n# Welcome\n\nWelcome page.',
      );

      const context = {
        siteDir: TEST_DIR,
        siteUrl: 'https://example.com',
        docsDir: 'docs',
        options: {},
        routesPaths: ['/welcome'],
      };

      const allFiles = [path.join(DOCS_DIR, 'intro.md')];

      const results = await processFilesWithPatterns(context, allFiles);
      const doc = results[0];

      if (doc && doc.url === 'https://example.com/welcome') {
        console.log('  ✓ PASS: Frontmatter slug override resolved to /welcome');
      } else {
        console.log('  ✗ FAIL: Expected /welcome via frontmatter slug override');
        console.log(`    Got: ${doc?.url}`);
      }
    }

    console.log('\n✓ All route resolution helper tests completed');
  } catch (err) {
    console.error('Test failed with error:', err);
    process.exit(1);
  } finally {
    await cleanupTestFiles();
  }
}

runTests().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
