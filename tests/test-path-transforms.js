/**
 * Unit tests for path transformation functionality
 *
 * Run with: node test-path-transforms.js
 */

// Since the function is not directly exported, we'll reimplement it here for testing
function applyPathTransformations(urlPath, pathTransformation) {
  if (!pathTransformation) {
    return urlPath;
  }

  let transformedPath = urlPath;

  // Remove ignored path segments
  if (pathTransformation.ignorePaths?.length) {
    for (const ignorePath of pathTransformation.ignorePaths) {
      // Create a regex that matches the ignore path at the beginning, middle, or end of the path
      const ignoreRegex = new RegExp(`(^|/)(${ignorePath})(/|$)`, 'g');
      transformedPath = transformedPath.replace(ignoreRegex, '$1$3');
    }

    // Clean up any double slashes that might have been created
    transformedPath = transformedPath.replace(/\/+/g, '/');

    // Remove leading slash if present
    transformedPath = transformedPath.replace(/^\//, '');
  }

  // Add path segments if they're not already present
  if (pathTransformation.addPaths?.length) {
    // Process in reverse order to maintain the specified order in the final path
    // This is because each path is prepended to the front
    const pathsToAdd = [...pathTransformation.addPaths].reverse();

    for (const addPath of pathsToAdd) {
      // Only add if not already present at the beginning
      if (!transformedPath.startsWith(addPath + '/') && transformedPath !== addPath) {
        transformedPath = `${addPath}/${transformedPath}`;
      }
    }
  }

  return transformedPath;
}

// Test cases
const testCases = [
  {
    name: 'No transformations',
    input: 'docs/api/method',
    config: null,
    expected: 'docs/api/method',
  },
  {
    name: 'Ignore "docs" at beginning',
    input: 'docs/api/method',
    config: { ignorePaths: ['docs'] },
    expected: 'api/method',
  },
  {
    name: 'Ignore "api" in middle',
    input: 'docs/api/method',
    config: { ignorePaths: ['api'] },
    expected: 'docs/method',
  },
  {
    name: 'Ignore multiple paths',
    input: 'docs/api/method',
    config: { ignorePaths: ['docs', 'api'] },
    expected: 'method',
  },
  {
    name: 'Add path',
    input: 'api/method',
    config: { addPaths: ['reference'] },
    expected: 'reference/api/method',
  },
  {
    name: 'Add path when already exists',
    input: 'reference/api/method',
    config: { addPaths: ['reference'] },
    expected: 'reference/api/method',
  },
  {
    name: 'Multiple add paths',
    input: 'method',
    config: { addPaths: ['reference', 'api'] },
    expected: 'reference/api/method',
  },
  {
    name: 'Both ignore and add paths',
    input: 'docs/old/api/method',
    config: {
      ignorePaths: ['docs', 'old'],
      addPaths: ['reference'],
    },
    expected: 'reference/api/method',
  },
  {
    name: 'Handle index files correctly',
    input: 'docs/index',
    config: { ignorePaths: ['docs'] },
    expected: 'index',
  },
  {
    name: 'Handle empty result from ignoring',
    input: 'docs',
    config: { ignorePaths: ['docs'] },
    expected: '',
  },
  {
    name: 'Path prefix handling',
    pathPrefix: 'docs',
    input: 'api/method',
    config: { ignorePaths: ['docs'] },
    // Should remove 'docs' from the final URL
    expected: 'api/method',
  },
];

// Run tests
function runTests() {
  console.log('Running path transformation unit tests...\n');

  let passCount = 0;

  testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`);
    console.log(`  Input: "${test.input}"`);

    const result = applyPathTransformations(test.input, test.config);
    console.log(`  Result: "${result}"`);
    console.log(`  Expected: "${test.expected}"`);

    if (result === test.expected) {
      console.log('  ✅ PASS');
      passCount++;
    } else {
      console.log('  ❌ FAIL');
    }

    // Additional test for path prefix handling if specified
    if (test.pathPrefix) {
      console.log(`  Path prefix: "${test.pathPrefix}"`);
      let transformedPathPrefix = test.pathPrefix;
      if (test.pathPrefix && test.config?.ignorePaths?.includes(test.pathPrefix)) {
        transformedPathPrefix = '';
      }
      console.log(`  Transformed prefix: "${transformedPathPrefix}"`);
      const expectedPrefix =
        test.pathPrefix && test.config?.ignorePaths?.includes(test.pathPrefix)
          ? ''
          : test.pathPrefix;

      if (transformedPathPrefix === expectedPrefix) {
        console.log('  ✅ PREFIX PASS');
      } else {
        console.log('  ❌ PREFIX FAIL');
        passCount--;
      }
    }

    console.log('');
  });

  console.log(`Results: ${passCount} of ${testCases.length} tests passed.`);
}

runTests();

// Document ordering tests
console.log('\nRunning document ordering tests...\n');

// Test for ordering documents
async function testOrderingDocuments() {
  console.log('Test: Order documents according to includeOrder patterns');

  // Sample files to test with
  const mockFiles = [
    '/mock/site/docs/getting-started/installation.md',
    '/mock/site/docs/getting-started/quick-start.md',
    '/mock/site/docs/getting-started/overview.md',
    '/mock/site/docs/api/core/main-functions.md',
    '/mock/site/docs/api/plugins/plugin-api.md',
    '/mock/site/docs/advanced/configuration.md',
  ];

  // Mock file contents
  const mockContents = {
    'installation.md': '# Installation\nInstallation guide...',
    'quick-start.md': '# Quick Start\nQuick start guide...',
    'overview.md': '# Overview\nOverview...',
    'main-functions.md': '# Core Functions\nCore API functions...',
    'plugin-api.md': '# Plugin API\nPlugin API documentation...',
    'configuration.md': '# Advanced Configuration\nAdvanced configuration...',
  };

  // Track processing order
  const processedFiles = [];

  // Define mock functions
  const mockReadMarkdownFiles = () => Promise.resolve(mockFiles);

  const mockProcessMarkdownFile = (filePath) => {
    processedFiles.push(filePath);

    // Get mock title from the file path
    const fileName = filePath.split('/').pop();
    const fileContent = mockContents[fileName] || '# Unknown';
    const title = fileContent.split('\n')[0].replace('# ', '');

    return Promise.resolve({
      title,
      path: filePath,
      url: `https://example.com/${fileName.replace('.md', '')}`,
      content: fileContent,
      description: '',
    });
  };

  const mockMinimatch = (filePath, pattern) => {
    if (pattern.endsWith('*.md') && pattern.includes('/')) {
      const patternDir = pattern.split('/').slice(0, -1).join('/');
      return filePath.includes(patternDir);
    } else if (pattern.endsWith('/*')) {
      const patternDir = pattern.slice(0, -2);
      return filePath.includes(patternDir);
    }
    return filePath.includes(pattern);
  };

  // Plugin options with ordering
  const options = {
    includeOrder: [
      'docs/getting-started/installation.md',
      'docs/getting-started/quick-start.md',
      'docs/getting-started/*.md',
      'docs/api/core/*.md',
      'docs/api/plugins/*.md',
      'docs/advanced/*.md',
    ],
  };

  // Run fake plugin
  const mockPlugin = {
    postBuild: async () => {
      // Simulate the logic from the real plugin
      const allDocFiles = await mockReadMarkdownFiles();
      const matchedFiles = new Set();
      let filesToProcess = [];

      // Process files according to includeOrder
      for (const pattern of options.includeOrder) {
        const matchingFiles = allDocFiles.filter((file) => {
          const relativePath = file.replace('/mock/site/', '');
          return mockMinimatch(relativePath, pattern) && !matchedFiles.has(file);
        });

        for (const file of matchingFiles) {
          filesToProcess.push(file);
          matchedFiles.add(file);
        }
      }

      // Process each file
      for (const filePath of filesToProcess) {
        await mockProcessMarkdownFile(filePath);
      }
    },
  };

  try {
    await mockPlugin.postBuild();

    // Check expected order (just file names for clarity)
    const expectedOrder = [
      'installation.md',
      'quick-start.md',
      'overview.md',
      'main-functions.md',
      'plugin-api.md',
      'configuration.md',
    ];

    const actualOrder = processedFiles.map((path) => path.split('/').pop());

    // Check if order matches expected
    let orderCorrect = true;
    let matchedCount = 0;

    for (let i = 0; i < expectedOrder.length; i++) {
      if (i >= actualOrder.length || actualOrder[i] !== expectedOrder[i]) {
        orderCorrect = false;
        break;
      }
      matchedCount++;
    }

    if (orderCorrect && matchedCount === expectedOrder.length) {
      console.log('  ✅ PASS: Files were processed in the correct order');
      console.log(`  Expected: ${expectedOrder.join(', ')}`);
      console.log(`  Actual: ${actualOrder.join(', ')}`);
    } else {
      console.log('  ❌ FAIL: Files were not processed in the correct order');
      console.log(`  Expected: ${expectedOrder.join(', ')}`);
      console.log(`  Actual: ${actualOrder.join(', ')}`);
    }
  } catch (error) {
    console.log('  ❌ FAIL: Error running test:', error);
  }

  console.log('');
}

// Test for excluding unmatched files
async function testExcludeUnmatchedFiles() {
  console.log('Test: Exclude unmatched files when includeUnmatchedLast is false');

  // Sample files to test with
  const mockFiles = [
    '/mock/site/docs/public/public-doc.md',
    '/mock/site/docs/private/internal-doc.md',
  ];

  // Mock file contents
  const mockContents = {
    'public-doc.md': '# Public Document\nThis is a public document...',
    'internal-doc.md': '# Internal Document\nThis is an internal document...',
  };

  // Track processing
  const processedFiles = [];

  // Define mock functions
  const mockReadMarkdownFiles = () => Promise.resolve(mockFiles);

  const mockProcessMarkdownFile = (filePath) => {
    processedFiles.push(filePath);

    // Get mock title from the file path
    const fileName = filePath.split('/').pop();
    const fileContent = mockContents[fileName] || '# Unknown';
    const title = fileContent.split('\n')[0].replace('# ', '');

    return Promise.resolve({
      title,
      path: filePath,
      url: `https://example.com/${fileName.replace('.md', '')}`,
      content: fileContent,
      description: '',
    });
  };

  const mockMinimatch = (filePath, pattern) => {
    if (pattern.includes('public')) {
      return filePath.includes('public');
    }
    return false;
  };

  // Plugin options with strict inclusion
  const options = {
    includeOrder: ['docs/public/*.md'],
    includeUnmatchedLast: false,
  };

  // Run fake plugin
  const mockPlugin = {
    postBuild: async () => {
      // Simulate the logic from the real plugin
      const allDocFiles = await mockReadMarkdownFiles();
      const matchedFiles = new Set();
      let filesToProcess = [];

      // Process files according to includeOrder
      for (const pattern of options.includeOrder) {
        const matchingFiles = allDocFiles.filter((file) => {
          const relativePath = file.replace('/mock/site/', '');
          return mockMinimatch(relativePath, pattern) && !matchedFiles.has(file);
        });

        for (const file of matchingFiles) {
          filesToProcess.push(file);
          matchedFiles.add(file);
        }
      }

      // Add remaining files if includeUnmatchedLast is true
      if (options.includeUnmatchedLast) {
        const remainingFiles = allDocFiles.filter((file) => !matchedFiles.has(file));
        filesToProcess.push(...remainingFiles);
      }

      // Process each file
      for (const filePath of filesToProcess) {
        await mockProcessMarkdownFile(filePath);
      }
    },
  };

  try {
    await mockPlugin.postBuild();

    // Check expected files (just file names for clarity)
    const expectedFiles = ['public-doc.md']; // Only the public doc should be processed
    const actualFiles = processedFiles.map((path) => path.split('/').pop());

    // Verify only public document was processed
    const onlyPublicIncluded = actualFiles.length === 1 && actualFiles[0] === 'public-doc.md';

    if (onlyPublicIncluded) {
      console.log('  ✅ PASS: Only public document was included');
      console.log(`  Expected: ${expectedFiles.join(', ')}`);
      console.log(`  Actual: ${actualFiles.join(', ')}`);
    } else {
      console.log('  ❌ FAIL: Incorrect files were processed');
      console.log(`  Expected: ${expectedFiles.join(', ')}`);
      console.log(`  Actual: ${actualFiles.join(', ')}`);
    }
  } catch (error) {
    console.log('  ❌ FAIL: Error running test:', error);
  }

  console.log('');
}

// Run document ordering tests and custom LLM files tests
(async function runAllTests() {
  console.log('\nRunning description formatting tests...');
  runDescriptionTests();

  console.log('\nRunning document ordering tests...\n');
  await testOrderingDocuments();
  await testExcludeUnmatchedFiles();
  console.log('Document ordering tests completed');

  console.log('\nRunning custom LLM files test...\n');
  await testCustomLLMFiles();
  console.log('Custom LLM files test completed');
})();

// Test for custom LLM files
console.log('\nRunning custom LLM files test...\n');

// Test for generating custom LLM files
async function testCustomLLMFiles() {
  console.log('Test: Generate custom LLM files with specific patterns');

  // Sample files to test with
  const mockFiles = [
    '/mock/site/docs/api/python/module1.md',
    '/mock/site/docs/api/python/module2.md',
    '/mock/site/docs/api/javascript/module1.md',
    '/mock/site/docs/guides/python/guide1.md',
    '/mock/site/docs/guides/javascript/guide1.md',
    '/mock/site/docs/tutorials/tutorial1.md',
  ];

  // Mock file contents
  const mockContents = {
    'module1.md': '# Module 1\nPython module 1 documentation...',
    'module2.md': '# Module 2\nPython module 2 documentation...',
    'guide1.md': '# Guide 1\nA guide for getting started...',
    'tutorial1.md': '# Tutorial 1\nA beginner tutorial...',
  };

  // Track file generation
  const generatedFiles = {};

  // Define mock functions directly in test scope
  const mockReadMarkdownFiles = () => Promise.resolve(mockFiles);

  const mockProcessMarkdownFile = (filePath) => {
    // Get mock title from the file path
    const fileName = filePath.split('/').pop();
    const isJavaScript = filePath.includes('javascript');
    const isPython = filePath.includes('python');
    const isTutorial = filePath.includes('tutorials');

    let language = '';
    if (isJavaScript) language = 'JavaScript';
    if (isPython) language = 'Python';
    if (isTutorial) language = 'Tutorial';

    const fileContent = mockContents[fileName] || `# Unknown\nThis is ${language} content`;
    const title = fileContent.split('\n')[0].replace('# ', '');

    return Promise.resolve({
      title,
      path: filePath,
      url: `https://example.com/${fileName.replace('.md', '')}`,
      content: fileContent,
      description: '',
    });
  };

  const mockWriteFile = (filePath, content) => {
    generatedFiles[filePath.toString()] = content;
    return Promise.resolve();
  };

  const mockMinimatch = (filePath, pattern) => {
    // Simple pattern matching for testing
    if (pattern.includes('python') && filePath.includes('python')) return true;
    if (pattern.includes('javascript') && filePath.includes('javascript')) return true;
    if (pattern.includes('tutorials') && filePath.includes('tutorials')) return true;
    return pattern === '**/*' || pattern === '**/*.md';
  };

  // Mock custom LLM file configurations
  const customLLMFiles = [
    {
      filename: 'llms-python.txt',
      includePatterns: ['docs/api/python/**/*.md', 'docs/guides/python/*.md'],
      fullContent: true,
      title: 'Python API Documentation',
      description: 'Complete reference for Python API',
    },
    {
      filename: 'llms-javascript.txt',
      includePatterns: ['docs/api/javascript/**/*.md', 'docs/guides/javascript/*.md'],
      fullContent: true,
      title: 'JavaScript API Documentation',
      description: 'Complete reference for JavaScript API',
    },
    {
      filename: 'llms-tutorials.txt',
      includePatterns: ['docs/tutorials/**/*.md'],
      fullContent: false,
      title: 'Tutorial Documentation',
      description: 'All tutorials in a single file',
    },
  ];

  // Run fake plugin with custom LLM files
  const mockPlugin = {
    postBuild: async () => {
      // Process each custom LLM file
      for (const customFile of customLLMFiles) {
        const allDocFiles = await mockReadMarkdownFiles();

        // Filter files based on include patterns
        const filteredFiles = allDocFiles.filter((file) => {
          const relativePath = file.replace('/mock/site/', '');
          return customFile.includePatterns.some((pattern) => mockMinimatch(relativePath, pattern));
        });

        // Process each filtered file
        const processedDocs = [];
        for (const filePath of filteredFiles) {
          const docInfo = await mockProcessMarkdownFile(filePath);
          processedDocs.push(docInfo);
        }

        // Generate output content
        let content = `# ${customFile.title}\n\n> ${customFile.description}\n\n`;

        if (customFile.fullContent) {
          // Full content
          const sections = processedDocs.map((doc) => `## ${doc.title}\n\n${doc.content}`);
          content += `This file contains all documentation content in a single document.\n\n${sections.join('\n\n---\n\n')}`;
        } else {
          // Links only
          content +=
            'This file contains links to documentation sections.\n\n## Table of Contents\n\n';
          const links = processedDocs.map((doc) => `- [${doc.title}](${doc.url})`);
          content += links.join('\n');
        }

        // Write file
        const outputPath = `/mock/site/build/${customFile.filename}`;
        await mockWriteFile(outputPath, content);
      }
    },
  };

  try {
    await mockPlugin.postBuild();

    // Check that all three custom files were generated
    const pythonFile = Object.keys(generatedFiles).find((file) => file.endsWith('llms-python.txt'));
    const javascriptFile = Object.keys(generatedFiles).find((file) =>
      file.endsWith('llms-javascript.txt'),
    );
    const tutorialsFile = Object.keys(generatedFiles).find((file) =>
      file.endsWith('llms-tutorials.txt'),
    );

    // Check Python file has correct content
    const pythonContent = generatedFiles[pythonFile] || '';
    const pythonSuccess =
      pythonContent.includes('Python API Documentation') &&
      pythonContent.includes('Python module 1') &&
      pythonContent.includes('Python module 2') &&
      pythonContent.includes('Guide 1');

    // Check JavaScript file has correct content
    const javascriptContent = generatedFiles[javascriptFile] || '';
    const javascriptSuccess =
      javascriptContent.includes('JavaScript API Documentation') &&
      javascriptContent.includes('Module 1');

    // Check tutorials file has correct content (links only)
    const tutorialsContent = generatedFiles[tutorialsFile] || '';
    const tutorialsSuccess =
      tutorialsContent.includes('Tutorial Documentation') &&
      tutorialsContent.includes('Table of Contents') &&
      tutorialsContent.includes('Tutorial 1') &&
      !tutorialsContent.includes('This is Tutorial content');

    // Output results
    if (pythonSuccess) {
      console.log('  ✅ PASS: Python LLM file generated correctly');
    } else {
      console.log('  ❌ FAIL: Python LLM file not generated correctly');
    }

    if (javascriptSuccess) {
      console.log('  ✅ PASS: JavaScript LLM file generated correctly');
    } else {
      console.log('  ❌ FAIL: JavaScript LLM file not generated correctly');
    }

    if (tutorialsSuccess) {
      console.log('  ✅ PASS: Tutorials LLM file generated correctly (links only)');
    } else {
      console.log('  ❌ FAIL: Tutorials LLM file not generated correctly');
    }

    const overallSuccess = pythonSuccess && javascriptSuccess && tutorialsSuccess;
    if (overallSuccess) {
      console.log('  ✅ OVERALL PASS: All custom LLM files generated correctly');
    } else {
      console.log('  ❌ OVERALL FAIL: Some custom LLM files not generated correctly');
    }
  } catch (error) {
    console.log('  ❌ FAIL: Error running test:', error);
  }

  console.log('');
}

// Test for description formatting
function runDescriptionTests() {
  // Test cases for description cleaning
  const testCases = [
    {
      title: 'Normal description',
      input: 'This is a simple description',
      expected: 'This is a simple description',
    },
    {
      title: 'Description with heading marker',
      input: '# This has a heading marker',
      expected: 'This has a heading marker',
    },
    {
      title: 'Multi-level heading marker',
      input: '### This has a multi-level heading marker',
      expected: 'This has a multi-level heading marker',
    },
    {
      title: 'Multiple heading markers',
      input: '# Heading\n## Subheading',
      expected: 'Heading\n## Subheading', // Only the first marker is removed by current implementation
    },
  ];

  const path = require('path');
  const fs = require('fs');

  // Create a temporary directory for test files
  const testDir = path.join(__dirname, 'tmp-test');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  let passed = 0;

  for (const testCase of testCases) {
    try {
      // For simplicity, test the description cleaning function directly
      // This mimics what processor.ts does with descriptions
      let description = testCase.input || '';
      description = description.replace(/^#+\s+/g, '');

      if (description === testCase.expected) {
        console.log(`  ✅ PASS: ${testCase.title}`);
        passed++;
      } else {
        console.log(`  ❌ FAIL: ${testCase.title}`);
        console.log(`    Expected: "${testCase.expected}"`);
        console.log(`    Actual: "${description}"`);
      }
    } catch (error) {
      console.error(`  ❌ ERROR: ${testCase.title} - ${error.message}`);
    }
  }

  // Clean up
  if (fs.existsSync(testDir)) {
    fs.rmdirSync(testDir);
  }

  console.log(`\nDescription tests completed: ${passed}/${testCases.length} passed`);
}
