/**
 * Tests for symlink loop detection in readMarkdownFiles
 *
 * Run with: node test-symlink-loops.js
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { readMarkdownFiles } = require('../lib/utils');

// Helper to create a temporary test directory
async function createTempDir() {
  const tmpDir = path.join(os.tmpdir(), `llm-plugin-symlink-test-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });
  return tmpDir;
}

// Helper to cleanup test directory
async function cleanupTempDir(tmpDir) {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

// Helper to create test markdown files
async function createTestFile(filePath, content = '# Test\n\nTest content') {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

const testCases = [
  {
    name: 'Handles normal directory structure without symlinks',
    async test() {
      const tmpDir = await createTempDir();

      try {
        // Create normal directory structure
        await createTestFile(path.join(tmpDir, 'docs', 'file1.md'));
        await createTestFile(path.join(tmpDir, 'docs', 'subdir', 'file2.md'));
        await createTestFile(path.join(tmpDir, 'docs', 'subdir', 'nested', 'file3.md'));

        const files = await readMarkdownFiles(
          path.join(tmpDir, 'docs'),
          tmpDir,
          [],
          'docs',
          false
        );

        if (files.length === 3) {
          return { passed: true };
        } else {
          return {
            passed: false,
            error: `Expected 3 files, got ${files.length}`
          };
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Detects and prevents circular symlink loops',
    async test() {
      const tmpDir = await createTempDir();

      try {
        // Create directory structure with circular symlink
        const docsDir = path.join(tmpDir, 'docs');
        const subdir = path.join(docsDir, 'subdir');

        await createTestFile(path.join(docsDir, 'file1.md'));
        await createTestFile(path.join(subdir, 'file2.md'));

        // Create a symlink that points back to parent directory (circular)
        const symlinkPath = path.join(subdir, 'link-to-docs');
        try {
          await fs.symlink(docsDir, symlinkPath, 'dir');
        } catch (error) {
          // Symlinks might not be supported on this platform
          console.log('⚠️  SKIP: Cannot create symlinks on this platform');
          return { passed: true, skipped: true };
        }

        // Capture console.warn output
        const originalWarn = console.warn;
        const warnings = [];
        console.warn = (msg) => warnings.push(msg);

        try {
          const files = await readMarkdownFiles(
            docsDir,
            tmpDir,
            [],
            'docs',
            false
          );

          // Restore console.warn
          console.warn = originalWarn;

          // Should find 2 unique files (file1.md and file2.md)
          // Should not enter infinite loop
          // Should have warning about symlink loop
          const hasLoopWarning = warnings.some(w =>
            w.includes('already visited path') || w.includes('symlink loop')
          );

          if (files.length === 2 && hasLoopWarning) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `Expected 2 files with loop warning. Got ${files.length} files. Warnings: ${warnings.join(', ')}`
            };
          }
        } finally {
          console.warn = originalWarn;
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Handles symlink to external directory',
    async test() {
      const tmpDir = await createTempDir();

      try {
        // Create two separate directories
        const docsDir = path.join(tmpDir, 'docs');
        const externalDir = path.join(tmpDir, 'external');

        await createTestFile(path.join(docsDir, 'file1.md'));
        await createTestFile(path.join(externalDir, 'file2.md'));

        // Create a symlink to external directory
        const symlinkPath = path.join(docsDir, 'link-to-external');
        try {
          await fs.symlink(externalDir, symlinkPath, 'dir');
        } catch (error) {
          console.log('⚠️  SKIP: Cannot create symlinks on this platform');
          return { passed: true, skipped: true };
        }

        const files = await readMarkdownFiles(
          docsDir,
          tmpDir,
          [],
          'docs',
          false
        );

        // Should find both files (one direct, one through symlink)
        if (files.length === 2) {
          return { passed: true };
        } else {
          return {
            passed: false,
            error: `Expected 2 files (including symlinked), got ${files.length}`
          };
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Handles broken symlinks gracefully',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const docsDir = path.join(tmpDir, 'docs');

        await createTestFile(path.join(docsDir, 'file1.md'));

        // Create a symlink to non-existent directory
        const symlinkPath = path.join(docsDir, 'broken-link');
        try {
          await fs.symlink(path.join(tmpDir, 'nonexistent'), symlinkPath, 'dir');
        } catch (error) {
          console.log('⚠️  SKIP: Cannot create symlinks on this platform');
          return { passed: true, skipped: true };
        }

        // Capture console.warn output
        const originalWarn = console.warn;
        const warnings = [];
        console.warn = (msg) => warnings.push(msg);

        try {
          const files = await readMarkdownFiles(
            docsDir,
            tmpDir,
            [],
            'docs',
            false
          );

          // Restore console.warn
          console.warn = originalWarn;

          // Should find 1 file and warn about broken symlink
          const hasBrokenLinkWarning = warnings.some(w =>
            w.includes('Skipping broken symlink')
          );

          if (files.length === 1 && hasBrokenLinkWarning) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `Expected 1 file with broken link warning. Got ${files.length} files. Warnings: ${warnings.join(', ')}`
            };
          }
        } finally {
          console.warn = originalWarn;
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Handles multiple symlinks to same directory',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const docsDir = path.join(tmpDir, 'docs');
        const targetDir = path.join(tmpDir, 'target');

        await createTestFile(path.join(docsDir, 'file1.md'));
        await createTestFile(path.join(targetDir, 'file2.md'));

        // Create two symlinks pointing to the same directory
        const symlink1 = path.join(docsDir, 'link1');
        const symlink2 = path.join(docsDir, 'link2');

        try {
          await fs.symlink(targetDir, symlink1, 'dir');
          await fs.symlink(targetDir, symlink2, 'dir');
        } catch (error) {
          console.log('⚠️  SKIP: Cannot create symlinks on this platform');
          return { passed: true, skipped: true };
        }

        // Capture console.warn output
        const originalWarn = console.warn;
        const warnings = [];
        console.warn = (msg) => warnings.push(msg);

        try {
          const files = await readMarkdownFiles(
            docsDir,
            tmpDir,
            [],
            'docs',
            false
          );

          // Restore console.warn
          console.warn = originalWarn;

          // Should find 2 unique files (file1.md and file2.md once)
          // Second symlink should be detected as already visited
          const hasVisitedWarning = warnings.some(w =>
            w.includes('already visited path')
          );

          if (files.length === 2 && hasVisitedWarning) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `Expected 2 files (no duplicates). Got ${files.length} files. Warnings: ${warnings.join(', ')}`
            };
          }
        } finally {
          console.warn = originalWarn;
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Handles deeply nested symlink chains',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const docsDir = path.join(tmpDir, 'docs');
        const level1 = path.join(tmpDir, 'level1');
        const level2 = path.join(tmpDir, 'level2');

        await createTestFile(path.join(docsDir, 'file1.md'));
        await createTestFile(path.join(level2, 'file2.md'));

        // Create chain: docs -> link1 -> level1 -> link2 -> level2
        const link1 = path.join(docsDir, 'link1');
        const link2 = path.join(level1, 'link2');

        try {
          await fs.mkdir(level1, { recursive: true });
          await fs.symlink(level1, link1, 'dir');
          await fs.symlink(level2, link2, 'dir');
        } catch (error) {
          console.log('⚠️  SKIP: Cannot create symlinks on this platform');
          return { passed: true, skipped: true };
        }

        const files = await readMarkdownFiles(
          docsDir,
          tmpDir,
          [],
          'docs',
          false
        );

        // Should find both files through the symlink chain
        if (files.length === 2) {
          return { passed: true };
        } else {
          return {
            passed: false,
            error: `Expected 2 files through symlink chain, got ${files.length}`
          };
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'visitedPaths set persists across recursive calls',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const docsDir = path.join(tmpDir, 'docs');
        const shared = path.join(tmpDir, 'shared');

        await createTestFile(path.join(docsDir, 'a', 'file1.md'));
        await createTestFile(path.join(docsDir, 'b', 'file2.md'));
        await createTestFile(path.join(shared, 'shared.md'));

        // Both subdirs link to shared directory
        const linkA = path.join(docsDir, 'a', 'link-shared');
        const linkB = path.join(docsDir, 'b', 'link-shared');

        try {
          await fs.symlink(shared, linkA, 'dir');
          await fs.symlink(shared, linkB, 'dir');
        } catch (error) {
          console.log('⚠️  SKIP: Cannot create symlinks on this platform');
          return { passed: true, skipped: true };
        }

        const files = await readMarkdownFiles(
          docsDir,
          tmpDir,
          [],
          'docs',
          false
        );

        // Should find 3 unique files (file1.md, file2.md, shared.md once)
        if (files.length === 3) {
          return { passed: true };
        } else {
          return {
            passed: false,
            error: `Expected 3 unique files, got ${files.length}. Files: ${files.join(', ')}`
          };
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  }
];

async function runTests() {
  console.log('Running symlink loop detection tests...\n');

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const testCase of testCases) {
    try {
      const result = await testCase.test();

      if (result.skipped) {
        console.log(`⚠️  SKIP: ${testCase.name}`);
        skipped++;
      } else if (result.passed) {
        console.log(`✅ PASS: ${testCase.name}`);
        passed++;
      } else {
        console.log(`❌ FAIL: ${testCase.name}`);
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${testCase.name}`);
      console.log(`   ${error.message}`);
      console.log(`   Stack: ${error.stack}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Symlink Loop Detection Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}, Total: ${testCases.length}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runTests()
  .then(success => {
    if (success) {
      console.log('🎉 All symlink loop detection tests passed!');
      process.exit(0);
    } else {
      console.log('❌ Some tests failed.');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
  });
