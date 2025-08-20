/**
 * Tests for header deduplication functionality
 * 
 * Run with: node test-header-deduplication.js
 */

const fs = require('fs');
const path = require('path');

// Mock the generateLLMFile function from generator.ts
function generateLLMFile(docs, outputPath, fileTitle, fileDescription, includeFullContent, version) {
  console.log(`Generating file: ${outputPath}, version: ${version || 'undefined'}`);
  const versionInfo = version ? `\n\nVersion: ${version}` : '';
  
  if (includeFullContent) {
    // Generate full content file with header deduplication
    const usedHeaders = new Set();
    const fullContentSections = docs.map(doc => {
      // Check if content already starts with the same heading to avoid duplication
      const trimmedContent = doc.content.trim();
      const firstLine = trimmedContent.split('\n')[0];
      
      // Check if the first line is a heading that matches our title
      const headingMatch = firstLine.match(/^#+\s+(.+)$/);
      const firstHeadingText = headingMatch ? headingMatch[1].trim() : null;
      
      // Determine the header text to use (original title or make it unique)
      let headerText = doc.title;
      let uniqueHeader = headerText;
      let counter = 1;
      
      // If this header has been used before, make it unique by adding a suffix
      while (usedHeaders.has(uniqueHeader.toLowerCase())) {
        counter++;
        // Try to make it more descriptive by adding the file path info if available
        if (doc.path && counter === 2) {
          const pathParts = doc.path.split('/');
          const folderName = pathParts.length > 1 ? pathParts[pathParts.length - 2] : '';
          if (folderName) {
            uniqueHeader = `${headerText} (${folderName.charAt(0).toUpperCase() + folderName.slice(1)})`;
          } else {
            uniqueHeader = `${headerText} (${counter})`;
          }
        } else {
          uniqueHeader = `${headerText} (${counter})`;
        }
      }
      
      usedHeaders.add(uniqueHeader.toLowerCase());
      
      if (firstHeadingText === doc.title) {
        // Content already has the same heading, replace it with our unique header if needed
        if (uniqueHeader !== doc.title) {
          const restOfContent = trimmedContent.split('\n').slice(1).join('\n');
          return `## ${uniqueHeader}

${restOfContent}`;
        } else {
          // Replace the existing H1 with H2 to comply with llmstxt.org standard
          const restOfContent = trimmedContent.split('\n').slice(1).join('\n');
          return `## ${uniqueHeader}

${restOfContent}`;
        }
      } else {
        // Content doesn't have the same heading, add our unique H2 header
        return `## ${uniqueHeader}

${doc.content}`;
      }
    });

    const llmFileContent = `# ${fileTitle}

> ${fileDescription}${versionInfo}

This file contains all documentation content in a single document following the llmstxt.org standard.

${fullContentSections.join('\n\n---\n\n')}
`;

    return llmFileContent;
  }
  
  return '';
}

// Test cases for header deduplication
const testCases = [
  {
    name: 'No duplicate headers',
    docs: [
      {
        title: 'Getting Started',
        path: 'docs/getting-started.md',
        content: '# Getting Started\n\nThis is the getting started guide.',
        description: 'Introduction to the system',
        url: 'https://example.com/getting-started'
      },
      {
        title: 'Advanced Usage',
        path: 'docs/advanced.md',
        content: '# Advanced Usage\n\nAdvanced usage guide.',
        description: 'Advanced features',
        url: 'https://example.com/advanced'
      }
    ],
    expectedHeaders: ['Getting Started', 'Advanced Usage']
  },
  {
    name: 'Duplicate headers with folder differentiation',
    docs: [
      {
        title: 'Configuration',
        path: 'docs/basic/configuration.md',
        content: '# Configuration\n\nBasic configuration options.',
        description: 'Basic configuration',
        url: 'https://example.com/basic/configuration'
      },
      {
        title: 'Configuration',
        path: 'docs/advanced/configuration.md',
        content: '# Configuration\n\nAdvanced configuration options.',
        description: 'Advanced configuration',
        url: 'https://example.com/advanced/configuration'
      }
    ],
    expectedHeaders: ['Configuration', 'Configuration (Advanced)']
  },
  {
    name: 'Multiple duplicate headers',
    docs: [
      {
        title: 'API Reference',
        path: 'docs/api/reference.md',
        content: '# API Reference\n\nGeneral API reference.',
        description: 'General API',
        url: 'https://example.com/api/reference'
      },
      {
        title: 'API Reference',
        path: 'docs/python/reference.md',
        content: '# API Reference\n\nPython API reference.',
        description: 'Python API',
        url: 'https://example.com/python/reference'
      },
      {
        title: 'API Reference',
        path: 'docs/javascript/reference.md',
        content: '# API Reference\n\nJavaScript API reference.',
        description: 'JavaScript API',
        url: 'https://example.com/javascript/reference'
      }
    ],
    expectedHeaders: ['API Reference', 'API Reference (Python)', 'API Reference (Javascript)']
  },
  {
    name: 'Headers without folder context fall back to numbers',
    docs: [
      {
        title: 'Tutorial',
        path: 'tutorial1.md',
        content: '# Tutorial\n\nFirst tutorial.',
        description: 'First tutorial',
        url: 'https://example.com/tutorial1'
      },
      {
        title: 'Tutorial',
        path: 'tutorial2.md',
        content: '# Tutorial\n\nSecond tutorial.',
        description: 'Second tutorial',
        url: 'https://example.com/tutorial2'
      }
    ],
    expectedHeaders: ['Tutorial', 'Tutorial (2)']
  },
  {
    name: 'Mixed content with and without existing headers',
    docs: [
      {
        title: 'Setup Guide',
        path: 'docs/setup/guide.md',
        content: '# Setup Guide\n\nSetup guide content.',
        description: 'Setup guide',
        url: 'https://example.com/setup/guide'
      },
      {
        title: 'Setup Guide',
        path: 'docs/install/guide.md',
        content: 'This is content without a heading.\n\nMore content here.',
        description: 'Install guide',
        url: 'https://example.com/install/guide'
      }
    ],
    expectedHeaders: ['Setup Guide', 'Setup Guide (Install)']
  }
];

function runTests() {
  console.log('Running header deduplication tests...\n');
  
  let passCount = 0;
  
  testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`);
    
    try {
      const output = generateLLMFile(
        test.docs,
        '/mock/output.txt',
        'Test Documentation',
        'Test description',
        true,
        'test-version'
      );
      
      // Extract H2 headers from the output (document sections should be H2)
      const headerMatches = output.match(/^## .+$/gm) || [];
      const actualHeaders = headerMatches.map(h => h.replace(/^## /, ''));
      
      // All document sections should be H2, so we use all found headers
      const contentHeaders = actualHeaders;
      
      console.log(`  Expected headers: ${test.expectedHeaders.join(', ')}`);
      console.log(`  Actual headers: ${contentHeaders.join(', ')}`);
      
      // Check if headers match expected
      const headersMatch = contentHeaders.length === test.expectedHeaders.length &&
                          contentHeaders.every((header, i) => header === test.expectedHeaders[i]);
      
      if (headersMatch) {
        console.log('  ✅ PASS');
        passCount++;
      } else {
        console.log('  ❌ FAIL');
        console.log(`    Expected: [${test.expectedHeaders.join(', ')}]`);
        console.log(`    Actual: [${contentHeaders.join(', ')}]`);
      }
      
    } catch (error) {
      console.log('  ❌ ERROR:', error.message);
    }
    
    console.log('');
  });
  
  console.log(`Results: ${passCount} of ${testCases.length} tests passed.`);
  
  if (passCount === testCases.length) {
    console.log('🎉 All header deduplication tests passed!');
  } else {
    console.log('❌ Some header deduplication tests failed.');
    process.exit(1);
  }
}

// Run the tests
runTests();