/**
 * Tests for path length validation and shortening functionality
 *
 * Run with: node test-path-length-validation.js
 */

const { validatePathLength, shortenPathIfNeeded } = require('../lib/utils');
const path = require('path');
const os = require('os');

const testCases = [
  // Windows path length tests
  {
    name: 'Short path on Windows should pass validation',
    platform: 'win32',
    path: 'C:\\Users\\test\\Documents\\file.md',
    expectedValid: true
  },
  {
    name: 'Path at Windows limit (260 chars) should fail validation',
    platform: 'win32',
    path: 'C:\\' + 'a'.repeat(258) + '.md',
    expectedValid: false
  },
  {
    name: 'Path exceeding Windows limit should fail validation',
    platform: 'win32',
    path: 'C:\\' + 'a'.repeat(300) + '.md',
    expectedValid: false
  },
  // Unix path length tests
  {
    name: 'Short path on Unix should pass validation',
    platform: 'linux',
    path: '/home/user/documents/file.md',
    expectedValid: true
  },
  {
    name: 'Path at Unix limit (4096 chars) should fail validation',
    platform: 'linux',
    path: '/' + 'a'.repeat(4095) + '.md',
    expectedValid: false
  },
  {
    name: 'Path exceeding Unix limit should fail validation',
    platform: 'linux',
    path: '/' + 'a'.repeat(5000) + '.md',
    expectedValid: false
  }
];

const shortenTestCases = [
  {
    name: 'Short path should not be shortened',
    fullPath: '/Users/test/output/docs/intro.md',
    outputDir: '/Users/test/output',
    relativePath: 'docs/intro.md',
    shouldShorten: false
  },
  {
    name: 'Very long Windows path should be shortened to hash-based name',
    platform: 'win32',
    fullPath: 'C:\\Users\\test\\output\\' + 'a'.repeat(300) + '.md',
    outputDir: 'C:\\Users\\test\\output',
    relativePath: 'a'.repeat(300) + '.md',
    shouldShorten: true,
    expectedPattern: /[a-f0-9]{8}\.md$/
  },
  {
    name: 'Very long Unix path should be shortened to hash-based name',
    platform: 'linux',
    fullPath: '/Users/test/output/' + 'a'.repeat(4200) + '.md',
    outputDir: '/Users/test/output',
    relativePath: 'a'.repeat(4200) + '.md',
    shouldShorten: true,
    expectedPattern: /[a-f0-9]{8}\.md$/
  }
];

console.log('Running path length validation tests...\n');

let passed = 0;
let failed = 0;

// Test validatePathLength with platform override
testCases.forEach(test => {
  const originalPlatform = process.platform;

  try {
    // Override platform for testing
    Object.defineProperty(process, 'platform', {
      value: test.platform,
      writable: true,
      configurable: true
    });

    const result = validatePathLength(test.path);

    if (result === test.expectedValid) {
      console.log(`✓ ${test.name}`);
      passed++;
    } else {
      console.error(`✗ ${test.name}`);
      console.error(`  Expected: ${test.expectedValid}, Got: ${result}`);
      console.error(`  Path length: ${test.path.length}`);
      failed++;
    }
  } catch (error) {
    console.error(`✗ ${test.name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  } finally {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    });
  }
});

console.log('\nRunning path shortening tests...\n');

shortenTestCases.forEach(test => {
  const originalPlatform = process.platform;

  try {
    // Override platform for testing if specified
    if (test.platform) {
      Object.defineProperty(process, 'platform', {
        value: test.platform,
        writable: true,
        configurable: true
      });
    }

    const result = shortenPathIfNeeded(test.fullPath, test.outputDir, test.relativePath);

    if (test.shouldShorten) {
      // Should be shortened
      if (result !== test.fullPath && test.expectedPattern.test(result)) {
        console.log(`✓ ${test.name}`);
        console.log(`  Original length: ${test.fullPath.length}`);
        console.log(`  Shortened: ${result}`);
        passed++;
      } else {
        console.error(`✗ ${test.name}`);
        console.error(`  Expected pattern: ${test.expectedPattern}`);
        console.error(`  Got: ${result}`);
        console.error(`  Original length: ${test.fullPath.length}`);
        failed++;
      }
    } else {
      // Should NOT be shortened
      if (result === test.fullPath) {
        console.log(`✓ ${test.name}`);
        passed++;
      } else {
        console.error(`✗ ${test.name}`);
        console.error(`  Expected: ${test.fullPath}`);
        console.error(`  Got: ${result}`);
        failed++;
      }
    }
  } catch (error) {
    console.error(`✗ ${test.name}`);
    console.error(`  Error: ${error.message}`);
    failed++;
  } finally {
    // Restore original platform
    if (test.platform) {
      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        writable: true,
        configurable: true
      });
    }
  }
});

// Test hash uniqueness
console.log('\nTesting hash-based shortening uniqueness...\n');

const originalPlatform = process.platform;
try {
  // Use Windows platform to ensure paths are considered too long
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    writable: true,
    configurable: true
  });

  const outputDir = 'C:\\test\\output';
  const paths = [
    'docs\\' + 'a'.repeat(300) + 'file1.md',
    'docs\\' + 'b'.repeat(300) + 'file2.md',
    'docs\\' + 'c'.repeat(300) + 'file3.md'
  ];

  // Create very long paths that exceed Windows limit
  const longPaths = paths.map(p => outputDir + '\\' + p);
  const shortenedPaths = longPaths.map((fullPath, i) =>
    shortenPathIfNeeded(fullPath, outputDir, paths[i])
  );

  // Check that all shortened paths are unique
  const uniquePaths = new Set(shortenedPaths);

  if (uniquePaths.size === shortenedPaths.length) {
    console.log('✓ Hash-based shortening produces unique paths');
    console.log(`  Generated ${shortenedPaths.length} unique shortened paths`);
    passed++;
  } else {
    console.error('✗ Hash-based shortening produces duplicate paths');
    console.error(`  Expected ${shortenedPaths.length} unique paths, got ${uniquePaths.size}`);
    failed++;
  }
} catch (error) {
  console.error('✗ Hash-based shortening uniqueness test');
  console.error(`  Error: ${error.message}`);
  failed++;
} finally {
  // Restore original platform
  Object.defineProperty(process, 'platform', {
    value: originalPlatform,
    writable: true,
    configurable: true
  });
}

// Test that shortened paths use relative path for hash
console.log('\nTesting hash generation from relative path...\n');

const originalPlatform2 = process.platform;
try {
  // Use Windows platform to ensure path is considered too long
  Object.defineProperty(process, 'platform', {
    value: 'win32',
    writable: true,
    configurable: true
  });

  const outputDir = 'C:\\test\\output';
  const relativePath = 'docs\\guide\\' + 'x'.repeat(300) + 'file.md';
  const fullPath = outputDir + '\\' + relativePath;

  const shortened = shortenPathIfNeeded(fullPath, outputDir, relativePath);

  // Check that the shortened path contains a hash and ends with .md
  if (shortened.match(/[a-f0-9]{8}\.md$/)) {
    console.log('✓ Shortened path uses hash from relative path');
    console.log(`  Shortened: ${shortened}`);
    passed++;
  } else {
    console.error('✗ Shortened path does not match expected format');
    console.error(`  Got: ${shortened}`);
    failed++;
  }
} catch (error) {
  console.error('✗ Hash generation test');
  console.error(`  Error: ${error.message}`);
  failed++;
} finally {
  // Restore original platform
  Object.defineProperty(process, 'platform', {
    value: originalPlatform2,
    writable: true,
    configurable: true
  });
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${passed}`);
console.log(`Tests failed: ${failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
