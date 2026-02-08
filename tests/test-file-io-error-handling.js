/**
 * Tests for file I/O error handling in generator functions
 *
 * Run with: node test-file-io-error-handling.js
 */

const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { generateLLMFile, generateIndividualMarkdownFiles } = require('../lib/generator');

// Helper to create a temporary test directory
async function createTempDir() {
  const tmpDir = path.join(os.tmpdir(), `llm-plugin-test-${Date.now()}`);
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

// Helper to create a read-only directory (simulating permission error)
async function makeReadOnly(dirPath) {
  try {
    // On Unix-like systems, chmod 444 makes it read-only
    await fs.chmod(dirPath, 0o444);
    return true;
  } catch (error) {
    console.warn('Warning: Could not make directory read-only. Skipping permission tests.');
    return false;
  }
}

// Helper to restore write permissions
async function restoreWritePermissions(dirPath) {
  try {
    await fs.chmod(dirPath, 0o755);
  } catch (error) {
    // Ignore restore errors
  }
}

const testCases = [
  {
    name: 'generateLLMFile handles write errors gracefully',
    async test() {
      const tmpDir = await createTempDir();

      try {
        // Create a read-only directory
        const readOnlyDir = path.join(tmpDir, 'readonly');
        await fs.mkdir(readOnlyDir, { recursive: true });
        const canMakeReadOnly = await makeReadOnly(readOnlyDir);

        if (!canMakeReadOnly) {
          console.log('⚠️  SKIP: Cannot test permission errors on this platform');
          return { passed: true, skipped: true };
        }

        const docs = [
          {
            title: 'Test Doc',
            content: 'Test content',
            url: 'https://example.com/test',
            path: '/test.md',
            description: 'Test description'
          }
        ];

        const outputPath = path.join(readOnlyDir, 'test-output.txt');

        try {
          await generateLLMFile(
            docs,
            outputPath,
            'Test Title',
            'Test Description',
            false
          );

          // If we get here, the test failed because no error was thrown
          await restoreWritePermissions(readOnlyDir);
          return { passed: false, error: 'Expected write error but none was thrown' };
        } catch (error) {
          // Check if the error message is descriptive
          const hasDescriptiveError = error.message.includes('Failed to write file') &&
                                      error.message.includes(outputPath);

          await restoreWritePermissions(readOnlyDir);

          if (hasDescriptiveError) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `Error message not descriptive enough: ${error.message}`
            };
          }
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'generateLLMFile with fullContent handles write errors',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const readOnlyDir = path.join(tmpDir, 'readonly');
        await fs.mkdir(readOnlyDir, { recursive: true });
        const canMakeReadOnly = await makeReadOnly(readOnlyDir);

        if (!canMakeReadOnly) {
          console.log('⚠️  SKIP: Cannot test permission errors on this platform');
          return { passed: true, skipped: true };
        }

        const docs = [
          {
            title: 'Test Doc',
            content: 'Test content',
            url: 'https://example.com/test',
            path: '/test.md',
            description: 'Test description'
          }
        ];

        const outputPath = path.join(readOnlyDir, 'test-output-full.txt');

        try {
          await generateLLMFile(
            docs,
            outputPath,
            'Test Title',
            'Test Description',
            true // fullContent
          );

          await restoreWritePermissions(readOnlyDir);
          return { passed: false, error: 'Expected write error but none was thrown' };
        } catch (error) {
          const hasDescriptiveError = error.message.includes('Failed to write file') &&
                                      error.message.includes(outputPath);

          await restoreWritePermissions(readOnlyDir);

          if (hasDescriptiveError) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `Error message not descriptive enough: ${error.message}`
            };
          }
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'generateIndividualMarkdownFiles handles mkdir errors',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const readOnlyParent = path.join(tmpDir, 'readonly-parent');
        await fs.mkdir(readOnlyParent, { recursive: true });
        const canMakeReadOnly = await makeReadOnly(readOnlyParent);

        if (!canMakeReadOnly) {
          console.log('⚠️  SKIP: Cannot test permission errors on this platform');
          return { passed: true, skipped: true };
        }

        const docs = [
          {
            title: 'Test Doc',
            content: 'Test content',
            url: 'https://example.com/test',
            path: '/nested/path/test.md',
            description: 'Test description',
            frontMatter: {}
          }
        ];

        try {
          // This should fail when trying to create subdirectories
          await generateIndividualMarkdownFiles(
            docs,
            path.join(readOnlyParent, 'output'),
            'https://example.com'
          );

          await restoreWritePermissions(readOnlyParent);
          return { passed: false, error: 'Expected mkdir error but none was thrown' };
        } catch (error) {
          const hasDescriptiveError = error.message.includes('Failed to create directory');

          await restoreWritePermissions(readOnlyParent);

          if (hasDescriptiveError) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `Error message not descriptive enough: ${error.message}`
            };
          }
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'generateIndividualMarkdownFiles handles write errors',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const outputDir = path.join(tmpDir, 'output');
        await fs.mkdir(outputDir, { recursive: true });

        // Create a read-only file with the same name as what we're trying to write
        const testFilePath = path.join(outputDir, 'test.md');
        await fs.writeFile(testFilePath, 'existing content');
        const canMakeReadOnly = await makeReadOnly(testFilePath);

        if (!canMakeReadOnly) {
          console.log('⚠️  SKIP: Cannot test permission errors on this platform');
          return { passed: true, skipped: true };
        }

        const docs = [
          {
            title: 'Test Doc',
            content: 'Test content',
            url: 'https://example.com/test',
            path: '/test.md',
            description: 'Test description',
            frontMatter: {}
          }
        ];

        try {
          await generateIndividualMarkdownFiles(
            docs,
            outputDir,
            'https://example.com'
          );

          await restoreWritePermissions(testFilePath);
          return { passed: false, error: 'Expected write error but none was thrown' };
        } catch (error) {
          const hasDescriptiveError = error.message.includes('Failed to write file') &&
                                      error.message.includes(testFilePath);

          await restoreWritePermissions(testFilePath);

          if (hasDescriptiveError) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `Error message not descriptive enough: ${error.message}`
            };
          }
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Error messages include full file paths for debugging',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const readOnlyDir = path.join(tmpDir, 'readonly');
        await fs.mkdir(readOnlyDir, { recursive: true });
        const canMakeReadOnly = await makeReadOnly(readOnlyDir);

        if (!canMakeReadOnly) {
          console.log('⚠️  SKIP: Cannot test permission errors on this platform');
          return { passed: true, skipped: true };
        }

        const docs = [{
          title: 'Test',
          content: 'Content',
          url: 'https://example.com/test',
          path: '/test.md',
          description: 'Desc'
        }];

        const outputPath = path.join(readOnlyDir, 'subdir', 'test.txt');

        try {
          await generateLLMFile(docs, outputPath, 'Title', 'Desc', false);
          await restoreWritePermissions(readOnlyDir);
          return { passed: false, error: 'Expected error but none was thrown' };
        } catch (error) {
          await restoreWritePermissions(readOnlyDir);

          // Check if the error message contains the full path
          const containsFullPath = error.message.includes(outputPath) ||
                                  error.message.includes(path.dirname(outputPath));

          if (containsFullPath) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `Error message does not include full path: ${error.message}`
            };
          }
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'Successful file operations complete without errors',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const outputDir = path.join(tmpDir, 'output');
        await fs.mkdir(outputDir, { recursive: true });

        const docs = [
          {
            title: 'Success Test',
            content: 'This should work',
            url: 'https://example.com/success',
            path: '/success.md',
            description: 'Success test'
          }
        ];

        const outputPath = path.join(outputDir, 'success.txt');

        try {
          await generateLLMFile(
            docs,
            outputPath,
            'Success Title',
            'Success Description',
            false
          );

          // Verify the file was actually created
          const fileExists = await fs.access(outputPath)
            .then(() => true)
            .catch(() => false);

          if (fileExists) {
            const content = await fs.readFile(outputPath, 'utf8');
            const hasExpectedContent = content.includes('Success Title');

            if (hasExpectedContent) {
              return { passed: true };
            } else {
              return { passed: false, error: 'File created but content is incorrect' };
            }
          } else {
            return { passed: false, error: 'File was not created' };
          }
        } catch (error) {
          return { passed: false, error: `Unexpected error: ${error.message}` };
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  },
  {
    name: 'generateIndividualMarkdownFiles creates nested directories successfully',
    async test() {
      const tmpDir = await createTempDir();

      try {
        const outputDir = path.join(tmpDir, 'output');

        const docs = [
          {
            title: 'Nested Test',
            content: 'Nested content',
            url: 'https://example.com/nested',
            path: '/deep/nested/path/test.md',
            description: 'Nested test',
            frontMatter: {}
          }
        ];

        try {
          const result = await generateIndividualMarkdownFiles(
            docs,
            outputDir,
            'https://example.com'
          );

          // Verify the file was created in the nested directory
          const expectedPath = path.join(outputDir, 'deep', 'nested', 'path', 'test.md');
          const fileExists = await fs.access(expectedPath)
            .then(() => true)
            .catch(() => false);

          if (fileExists && result.length === 1) {
            return { passed: true };
          } else {
            return {
              passed: false,
              error: `File not created at expected path: ${expectedPath}`
            };
          }
        } catch (error) {
          return { passed: false, error: `Unexpected error: ${error.message}` };
        }
      } finally {
        await cleanupTempDir(tmpDir);
      }
    }
  }
];

async function runTests() {
  console.log('Running file I/O error handling tests...\n');

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
  console.log(`File I/O Error Handling Tests Summary:`);
  console.log(`Passed: ${passed}, Failed: ${failed}, Skipped: ${skipped}, Total: ${testCases.length}`);
  console.log(`========================================\n`);

  return failed === 0;
}

// Run the tests
runTests()
  .then(success => {
    if (success) {
      console.log('🎉 All file I/O error handling tests passed!');
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
