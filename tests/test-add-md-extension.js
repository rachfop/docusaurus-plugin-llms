const fs = require('fs').promises;
const path = require('path');
const { generateLLMFile } = require('../lib/generator');

async function setupTestDir() {
  const testDir = path.join(__dirname, 'test-add-md-extension-temp');

  try {
    await fs.rm(testDir, { recursive: true });
  } catch (err) {
    // Ignore if doesn't exist
  }

  await fs.mkdir(testDir, { recursive: true });

  return testDir;
}

const sampleDocs = [
  {
    title: 'Getting Started',
    path: 'docs/getting-started.md',
    url: 'https://example.com/docs/getting-started/',
    content: 'This is the getting started guide.',
    description: 'Learn how to get started'
  },
  {
    title: 'API Reference',
    path: 'docs/api-reference.md',
    url: 'https://example.com/docs/api-reference/',
    content: 'This is the API reference.',
    description: 'Complete API documentation'
  }
];

async function runTests() {
  console.log('Running addMdExtension tests...\n');

  const testDir = await setupTestDir();
  let allTestsPassed = true;

  function check(label, condition) {
    if (condition) {
      console.log(`  ✅ PASS: ${label}`);
    } else {
      console.log(`  ❌ FAIL: ${label}`);
      allTestsPassed = false;
    }
  }

  try {
    // Test 1: Default (true) strips trailing slash and appends .md
    console.log('Test 1: Default addMdExtension with trailing-slash URLs');
    const defaultPath = path.join(testDir, 'default.txt');
    await generateLLMFile(sampleDocs, defaultPath, 'Docs', 'Desc', false);
    const defaultContent = await fs.readFile(defaultPath, 'utf-8');
    check(
      'Trailing slash stripped, .md appended',
      defaultContent.includes('(https://example.com/docs/getting-started.md)') &&
      defaultContent.includes('(https://example.com/docs/api-reference.md)')
    );
    check('No /.md artifact', !defaultContent.includes('/.md)'));
    console.log('');

    // Test 2: Default (true) with URLs that have no trailing slash
    console.log('Test 2: Default addMdExtension with no-trailing-slash URLs');
    const noSlashDocs = sampleDocs.map(d => ({ ...d, url: d.url.replace(/\/$/, '') }));
    const noSlashPath = path.join(testDir, 'no-slash.txt');
    await generateLLMFile(noSlashDocs, noSlashPath, 'Docs', 'Desc', false);
    const noSlashContent = await fs.readFile(noSlashPath, 'utf-8');
    check(
      '.md appended directly',
      noSlashContent.includes('(https://example.com/docs/getting-started.md)') &&
      noSlashContent.includes('(https://example.com/docs/api-reference.md)')
    );
    console.log('');

    // Test 3: addMdExtension=false preserves original URLs
    console.log('Test 3: addMdExtension disabled');
    const disabledPath = path.join(testDir, 'disabled.txt');
    await generateLLMFile(
      sampleDocs, disabledPath, 'Docs', 'Desc', false,
      undefined, undefined, 100, false
    );
    const disabledContent = await fs.readFile(disabledPath, 'utf-8');
    check(
      'URLs unchanged (trailing slash preserved)',
      disabledContent.includes('(https://example.com/docs/getting-started/)') &&
      disabledContent.includes('(https://example.com/docs/api-reference/)')
    );
    check('No .md appended', !disabledContent.includes('.md)'));
    console.log('');

    // Test 4: Sectioned docs apply .md through the sectioned code path
    console.log('Test 4: Sectioned docs with addMdExtension');
    const sectionedDocs = [
      { ...sampleDocs[0], section: 'Guides' },
      { ...sampleDocs[1], section: 'Reference' }
    ];
    const sectionedPath = path.join(testDir, 'sectioned.txt');
    await generateLLMFile(sectionedDocs, sectionedPath, 'Docs', 'Desc', false);
    const sectionedContent = await fs.readFile(sectionedPath, 'utf-8');
    check(
      '.md appended in sectioned links',
      sectionedContent.includes('(https://example.com/docs/getting-started.md)') &&
      sectionedContent.includes('(https://example.com/docs/api-reference.md)')
    );
    console.log('');

    // Test 5: URLs already ending with .md are not double-suffixed
    console.log('Test 5: No double .md when URL already ends with .md');
    const alreadyMdDocs = [{ ...sampleDocs[0], url: 'https://example.com/docs/getting-started.md' }];
    const alreadyMdPath = path.join(testDir, 'already-md.txt');
    await generateLLMFile(alreadyMdDocs, alreadyMdPath, 'Docs', 'Desc', false);
    const alreadyMdContent = await fs.readFile(alreadyMdPath, 'utf-8');
    check('No .md.md artifact', !alreadyMdContent.includes('.md.md'));
    check(
      'Single .md preserved',
      alreadyMdContent.includes('(https://example.com/docs/getting-started.md)')
    );
    console.log('');

  } catch (error) {
    console.error('Test error:', error);
    allTestsPassed = false;
  } finally {
    try {
      await fs.rm(testDir, { recursive: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  }

  if (allTestsPassed) {
    console.log('Results: All addMdExtension tests passed.');
    console.log('🎉 addMdExtension is working correctly!');
  } else {
    console.log('Results: Some tests failed.');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
