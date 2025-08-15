/**
 * Tests for import statement removal functionality
 * 
 * Run with: node test-import-removal.js
 */

// Mock the cleanMarkdownContent function from utils.ts
function cleanMarkdownContent(content, excludeImports = false, removeDuplicateHeadings = false) {
  let cleaned = content;
  
  // Remove import statements if requested
  if (excludeImports) {
    // Remove ES6/React import statements
    // This regex matches:
    // - import ... from "...";
    // - import ... from '...';
    // - import { ... } from "...";
    // - import * as ... from "...";
    // - import "..."; (side-effect imports)
    cleaned = cleaned.replace(/^\s*import\s+.*?;?\s*$/gm, '');
  }
  
  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // Remove redundant content that just repeats the heading (if requested)
  if (removeDuplicateHeadings) {
    // Split content into lines and process line by line
    const lines = cleaned.split('\n');
    const processedLines = [];
    let i = 0;
    
    while (i < lines.length) {
      const currentLine = lines[i];
      
      // Check if current line is a heading (accounting for leading whitespace)
      const headingMatch = currentLine.match(/^\s*(#+)\s+(.+)$/);
      if (headingMatch) {
        const headingLevel = headingMatch[1];
        const headingText = headingMatch[2].trim();
        
        processedLines.push(currentLine);
        i++;
        
        // Look ahead for potential redundant content
        // Skip empty lines
        while (i < lines.length && lines[i].trim() === '') {
          processedLines.push(lines[i]);
          i++;
        }
        
        // Check if the next non-empty line just repeats the heading text
        // but is NOT itself a heading (to avoid removing valid headings of different levels)
        if (i < lines.length) {
          const nextLine = lines[i].trim();
          const nextLineIsHeading = /^\s*#+\s+/.test(nextLine);
          
          // Only remove if it exactly matches the heading text AND is not a heading itself
          if (nextLine === headingText && !nextLineIsHeading) {
            // Skip this redundant line
            i++;
          }
        }
      } else {
        processedLines.push(currentLine);
        i++;
      }
    }
    
    cleaned = processedLines.join('\n');
  }
  
  // Normalize whitespace
  cleaned = cleaned.replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
    
  return cleaned;
}

// Test cases for import removal
const testCases = [
  {
    name: 'Basic ES6 import with double quotes',
    input: `import React from "react";

# Component

This is a component.`,
    expectedWithImports: `import React from "react";

# Component

This is a component.`,
    expectedWithoutImports: `# Component

This is a component.`
  },
  {
    name: 'Basic ES6 import with single quotes',
    input: `import React from 'react';

# Component

This is a component.`,
    expectedWithImports: `import React from 'react';

# Component

This is a component.`,
    expectedWithoutImports: `# Component

This is a component.`
  },
  {
    name: 'Named imports with destructuring',
    input: `import { Button, Card } from "@site/src/components";

# Components

These are components.`,
    expectedWithImports: `import { Button, Card } from "@site/src/components";

# Components

These are components.`,
    expectedWithoutImports: `# Components

These are components.`
  },
  {
    name: 'Star imports',
    input: `import * as React from "react";

# React Component

This uses React.`,
    expectedWithImports: `import * as React from "react";

# React Component

This uses React.`,
    expectedWithoutImports: `# React Component

This uses React.`
  },
  {
    name: 'Multiple imports',
    input: `import React from "react";
import { useState } from "react";
import Button from "@site/src/components/Button";

# Multi Import Component

Uses multiple imports.`,
    expectedWithImports: `import React from "react";
import { useState } from "react";
import Button from "@site/src/components/Button";

# Multi Import Component

Uses multiple imports.`,
    expectedWithoutImports: `# Multi Import Component

Uses multiple imports.`
  },
  {
    name: 'Side-effect imports',
    input: `import "./styles.css";
import "@site/src/css/custom.css";

# Styled Component

This component has styles.`,
    expectedWithImports: `import "./styles.css";
import "@site/src/css/custom.css";

# Styled Component

This component has styles.`,
    expectedWithoutImports: `# Styled Component

This component has styles.`
  },
  {
    name: 'Mixed imports with content',
    input: `---
title: My Page
---

import ConfigKeyList from "@site/src/components/ConfigKeyList";
import { RefreshCcwIcon } from "lucide-react";

# Configuration Keys

This page shows configuration keys.

<ConfigKeyList />`,
    expectedWithImports: `---
title: My Page
---

import ConfigKeyList from "@site/src/components/ConfigKeyList";
import { RefreshCcwIcon } from "lucide-react";

# Configuration Keys

This page shows configuration keys.`, // HTML tags are removed by cleanMarkdownContent
    expectedWithoutImports: `---
title: My Page
---

# Configuration Keys

This page shows configuration keys.`
  },
  {
    name: 'Imports with spaces and indentation',
    input: `  import React from "react";
    import { Component } from "react";

# Indented Imports

Content here.`,
    expectedWithImports: `import React from "react";
    import { Component } from "react";

# Indented Imports

Content here.`, // Leading whitespace is normalized
    expectedWithoutImports: `# Indented Imports

Content here.`
  },
  {
    name: 'No imports in content',
    input: `# Regular Content

This has no imports.

Some more content here.`,
    expectedWithImports: `# Regular Content

This has no imports.

Some more content here.`,
    expectedWithoutImports: `# Regular Content

This has no imports.

Some more content here.`
  },
  {
    name: 'Imports without semicolons',
    input: `import React from "react"
import Button from "./Button"

# No Semicolons

Content without semicolons.`,
    expectedWithImports: `import React from "react"
import Button from "./Button"

# No Semicolons

Content without semicolons.`,
    expectedWithoutImports: `# No Semicolons

Content without semicolons.`
  }
];

function runTests() {
  console.log('Running import removal tests...\n');
  
  let passCount = 0;
  
  testCases.forEach((test, index) => {
    console.log(`Test ${index + 1}: ${test.name}`);
    
    try {
      // Test with imports preserved (excludeImports = false)
      const resultWithImports = cleanMarkdownContent(test.input, false);
      const withImportsPass = resultWithImports === test.expectedWithImports;
      
      // Test with imports removed (excludeImports = true)
      const resultWithoutImports = cleanMarkdownContent(test.input, true);
      const withoutImportsPass = resultWithoutImports === test.expectedWithoutImports;
      
      console.log(`  With imports preserved: ${withImportsPass ? '✅ PASS' : '❌ FAIL'}`);
      if (!withImportsPass) {
        console.log(`    Expected: "${test.expectedWithImports}"`);
        console.log(`    Actual: "${resultWithImports}"`);
      }
      
      console.log(`  With imports removed: ${withoutImportsPass ? '✅ PASS' : '❌ FAIL'}`);
      if (!withoutImportsPass) {
        console.log(`    Expected: "${test.expectedWithoutImports}"`);
        console.log(`    Actual: "${resultWithoutImports}"`);
      }
      
      if (withImportsPass && withoutImportsPass) {
        passCount++;
      }
      
    } catch (error) {
      console.log('  ❌ ERROR:', error.message);
    }
    
    console.log('');
  });
  
  console.log(`Results: ${passCount} of ${testCases.length} tests passed.`);
  
  if (passCount === testCases.length) {
    console.log('🎉 All import removal tests passed!');
  } else {
    console.log('❌ Some import removal tests failed.');
    process.exit(1);
  }
}

// Additional test for duplicate heading removal
function testDuplicateHeadingRemoval() {
  console.log('\nRunning duplicate heading removal tests...\n');
  
  const duplicateHeadingTests = [
    {
      name: 'Remove redundant text after heading',
      input: `# Getting Started

Getting Started

This is the real content.`,
      expected: `# Getting Started

This is the real content.`
    },
    {
      name: 'Keep different text after heading',
      input: `# Getting Started

Introduction

This is different content.`,
      expected: `# Getting Started

Introduction

This is different content.`
    },
    {
      name: 'Multiple levels of headings',
      input: `# Main Title

Main Title

## Subsection

Different content here.`,
      expected: `# Main Title

## Subsection

Different content here.`
    },
    {
      name: 'Don\'t remove valid subheadings',
      input: `# API Reference

## API Reference Methods

This should not be removed.`,
      expected: `# API Reference

## API Reference Methods

This should not be removed.`
    }
  ];
  
  let passCount = 0;
  
  duplicateHeadingTests.forEach((test, index) => {
    console.log(`Duplicate Heading Test ${index + 1}: ${test.name}`);
    
    try {
      const result = cleanMarkdownContent(test.input, false, true);
      const pass = result === test.expected;
      
      console.log(`  ${pass ? '✅ PASS' : '❌ FAIL'}`);
      if (!pass) {
        console.log(`    Expected: "${test.expected}"`);
        console.log(`    Actual: "${result}"`);
      }
      
      if (pass) {
        passCount++;
      }
      
    } catch (error) {
      console.log('  ❌ ERROR:', error.message);
    }
    
    console.log('');
  });
  
  console.log(`Duplicate Heading Results: ${passCount} of ${duplicateHeadingTests.length} tests passed.`);
  
  if (passCount === duplicateHeadingTests.length) {
    console.log('🎉 All duplicate heading removal tests passed!');
  } else {
    console.log('❌ Some duplicate heading removal tests failed.');
    process.exit(1);
  }
}

// Run the tests
runTests();
testDuplicateHeadingRemoval();