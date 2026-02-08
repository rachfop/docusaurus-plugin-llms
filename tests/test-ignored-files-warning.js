/**
 * Tests for ignored files warning functionality
 *
 * Run with: node test-ignored-files-warning.js
 */

const fs = require('fs');
const path = require('path');
const { readMarkdownFiles } = require('../lib/utils');

// Mock console.warn to capture warnings
let warnings = [];
const originalWarn = console.warn;

function mockWarn() {
  console.warn = (message) => {
    warnings.push(message);
  };
}

function restoreWarn() {
  console.warn = originalWarn;
}

function clearWarnings() {
  warnings = [];
}

// Helper to create test directory with various file types
function setupTestDirectory(testDir) {
  // Clean up and create test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  // Create valid markdown files
  fs.writeFileSync(path.join(testDir, 'valid.md'), '# Valid Markdown\nContent here.');
  fs.writeFileSync(path.join(testDir, 'valid.mdx'), '# Valid MDX\nContent here.');

  // Create file without extension
  fs.writeFileSync(path.join(testDir, 'README'), '# README file without extension');

  // Create files with unsupported extensions
  fs.writeFileSync(path.join(testDir, 'data.json'), '{"key": "value"}');
  fs.writeFileSync(path.join(testDir, 'script.js'), 'console.log("test");');
  fs.writeFileSync(path.join(testDir, 'style.css'), 'body { margin: 0; }');
  fs.writeFileSync(path.join(testDir, 'document.txt'), 'Plain text document');

  // Create subdirectory with more files
  const subDir = path.join(testDir, 'subdir');
  fs.mkdirSync(subDir, { recursive: true });
  fs.writeFileSync(path.join(subDir, 'nested.md'), '# Nested Markdown');
  fs.writeFileSync(path.join(subDir, 'LICENSE'), 'License text without extension');
  fs.writeFileSync(path.join(subDir, 'config.yaml'), 'key: value');
}

// Test cases
const testCases = [
  {
    name: 'No warnings when warnOnIgnoredFiles is false',
    warnOnIgnoredFiles: false,
    expectedWarningCount: 0,
    expectedFiles: 3, // valid.md, valid.mdx, subdir/nested.md
  },
  {
    name: 'Warnings for files without extension when enabled',
    warnOnIgnoredFiles: true,
    expectedWarningCount: 7, // README, LICENSE, data.json, script.js, style.css, document.txt, config.yaml
    expectedFiles: 3, // valid.md, valid.mdx, subdir/nested.md
    expectedWarningPatterns: [
      /Ignoring file without extension.*README/,
      /Ignoring file without extension.*LICENSE/,
      /Ignoring file with unsupported extension.*data\.json/,
      /Ignoring file with unsupported extension.*script\.js/,
      /Ignoring file with unsupported extension.*style\.css/,
      /Ignoring file with unsupported extension.*document\.txt/,
      /Ignoring file with unsupported extension.*config\.yaml/,
    ],
  },
];

async function runTests() {
  console.log('Running ignored files warning tests...\n');

  const testDir = path.join(__dirname, 'test-ignored-files-warning');
  const baseDir = path.join(__dirname, '..');
  let passed = 0;
  let failed = 0;

  try {
    setupTestDirectory(testDir);

    for (const testCase of testCases) {
      console.log(`Test: ${testCase.name}`);

      try {
        clearWarnings();
        mockWarn();

        const files = await readMarkdownFiles(
          testDir,
          baseDir,
          [], // no ignore patterns
          'docs',
          testCase.warnOnIgnoredFiles
        );

        restoreWarn();

        // Check file count
        if (files.length !== testCase.expectedFiles) {
          throw new Error(
            `Expected ${testCase.expectedFiles} files, got ${files.length}`
          );
        }

        // Check warning count
        if (warnings.length !== testCase.expectedWarningCount) {
          throw new Error(
            `Expected ${testCase.expectedWarningCount} warnings, got ${warnings.length}. Warnings: ${JSON.stringify(warnings)}`
          );
        }

        // Check warning patterns if specified
        if (testCase.expectedWarningPatterns) {
          for (const pattern of testCase.expectedWarningPatterns) {
            const found = warnings.some(warning => pattern.test(warning));
            if (!found) {
              throw new Error(
                `Expected warning matching pattern ${pattern}, but not found in: ${JSON.stringify(warnings)}`
              );
            }
          }
        }

        // Verify that valid markdown files are still found
        const hasValidMd = files.some(f => f.endsWith('valid.md'));
        const hasValidMdx = files.some(f => f.endsWith('valid.mdx'));
        const hasNestedMd = files.some(f => f.endsWith('nested.md'));

        if (!hasValidMd || !hasValidMdx || !hasNestedMd) {
          throw new Error(
            'Expected to find valid.md, valid.mdx, and nested.md in results'
          );
        }

        console.log('✅ PASS');
        passed++;
      } catch (error) {
        restoreWarn();
        console.log(`❌ FAIL: ${error.message}`);
        failed++;
      }
    }
  } finally {
    // Clean up
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true });
    }
  }

  console.log(`\n========================================`);
  console.log(`Ignored Files Warning Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Total: ${passed + failed}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runTests()
  .then(success => {
    console.log(
      success
        ? '🎉 All ignored files warning tests passed!'
        : '❌ Some ignored files warning tests failed.'
    );
    if (!success) process.exit(1);
  })
  .catch(error => {
    console.error('Test runner error:', error);
    process.exit(1);
  });
