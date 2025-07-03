/**
 * LLM file generation functions for the docusaurus-plugin-llms plugin
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { DocInfo, PluginContext, CustomLLMFile } from './types';
import { writeFile, readMarkdownFiles } from './utils';
import { processFilesWithPatterns } from './processor';

/**
 * Clean a description for use in a TOC item
 * @param description - The original description
 * @returns Cleaned description suitable for TOC
 */
function cleanDescriptionForToc(description: string): string {
  if (!description) return '';
  
  // Get just the first line for TOC display
  const firstLine = description.split('\n')[0];
  
  // Remove heading markers only at the beginning of the line
  // Be careful to only remove actual heading markers (# followed by space at beginning)
  // and not hashtag symbols that are part of the content (inline hashtags)
  const cleaned = firstLine.replace(/^(#+)\s+/g, '');
  
  // Truncate if too long (150 characters max with ellipsis)
  return cleaned.length > 150 ? cleaned.substring(0, 147) + '...' : cleaned;
}

/**
 * Generate an LLM-friendly file
 * @param docs - Processed document information
 * @param outputPath - Path to write the output file
 * @param fileTitle - Title for the file
 * @param fileDescription - Description for the file
 * @param includeFullContent - Whether to include full content or just links
 * @param version - Version of the file
 */
export async function generateLLMFile(
  docs: DocInfo[],
  outputPath: string,
  fileTitle: string,
  fileDescription: string,
  includeFullContent: boolean,
  version?: string
): Promise<void> {
  console.log(`Generating file: ${outputPath}, version: ${version || 'undefined'}`);
  const versionInfo = version ? `\n\nVersion: ${version}` : '';
  
  if (includeFullContent) {
    // Generate full content file
    const fullContentSections = docs.map(doc => {
      return `## ${doc.title}

${doc.content}`;
    });

    const llmFileContent = `# ${fileTitle}

> ${fileDescription}${versionInfo}

This file contains all documentation content in a single document following the llmstxt.org standard.

${fullContentSections.join('\n\n---\n\n')}
`;

    await writeFile(outputPath, llmFileContent);
  } else {
    // Generate links-only file
    const tocItems = docs.map(doc => {
      // Clean and format the description for TOC
      const cleanedDescription = cleanDescriptionForToc(doc.description);
      
      return `- [${doc.title}](${doc.url})${cleanedDescription ? `: ${cleanedDescription}` : ''}`;
    });

    const llmFileContent = `# ${fileTitle}

> ${fileDescription}${versionInfo}

This file contains links to documentation sections following the llmstxt.org standard.

## Table of Contents

${tocItems.join('\n')}
`;

    await writeFile(outputPath, llmFileContent);
  }
  
  console.log(`Generated: ${outputPath}`);
}

/**
 * Generate standard LLM files (llms.txt and llms-full.txt)
 * @param context - Plugin context
 * @param allDocFiles - Array of all document files
 */
export async function generateStandardLLMFiles(
  context: PluginContext,
  allDocFiles: string[]
): Promise<void> {
  const { 
    outDir, 
    docTitle, 
    docDescription, 
    options 
  } = context;
  
  const { 
    generateLLMsTxt, 
    generateLLMsFullTxt,
    llmsTxtFilename = 'llms.txt',
    llmsFullTxtFilename = 'llms-full.txt',
    includeOrder = [],
    includeUnmatchedLast = true,
    version
  } = options;
  
  if (!generateLLMsTxt && !generateLLMsFullTxt) {
    return;
  }
  
  // Process files for the standard outputs
  const processedDocs = await processFilesWithPatterns(
    context,
    allDocFiles,
    [], // No specific include patterns - include all
    [], // No additional ignore patterns beyond global ignoreFiles
    includeOrder,
    includeUnmatchedLast
  );
  
  console.log(`Processed ${processedDocs.length} documentation files for standard LLM files`);
  
  // Generate llms.txt
  if (generateLLMsTxt) {
    const llmsTxtPath = path.join(outDir, llmsTxtFilename);
    await generateLLMFile(
      processedDocs,
      llmsTxtPath,
      docTitle,
      docDescription,
      false, // links only
      version
    );
  }

  // Generate llms-full.txt
  if (generateLLMsFullTxt) {
    const llmsFullTxtPath = path.join(outDir, llmsFullTxtFilename);
    await generateLLMFile(
      processedDocs,
      llmsFullTxtPath,
      docTitle,
      docDescription,
      true, // full content
      version
    );
  }
}

/**
 * Generate custom LLM files based on configuration
 * @param context - Plugin context
 * @param allDocFiles - Array of all document files
 */
export async function generateCustomLLMFiles(
  context: PluginContext,
  allDocFiles: string[]
): Promise<void> {
  const { outDir, docTitle, docDescription, options } = context;
  const { customLLMFiles = [], ignoreFiles = [] } = options;
  
  if (customLLMFiles.length === 0) {
    return;
  }
  
  console.log(`Generating ${customLLMFiles.length} custom LLM files...`);
  
  for (const customFile of customLLMFiles) {
    console.log(`Processing custom file: ${customFile.filename}, version: ${customFile.version || 'undefined'}`);
    
    // Combine global ignores with custom ignores
    const combinedIgnores = [...ignoreFiles];
    if (customFile.ignorePatterns) {
      combinedIgnores.push(...customFile.ignorePatterns);
    }
    
    // Process files according to the custom configuration
    const customDocs = await processFilesWithPatterns(
      context,
      allDocFiles,
      customFile.includePatterns,
      combinedIgnores,
      customFile.orderPatterns || [],
      customFile.includeUnmatchedLast ?? false
    );
    
    if (customDocs.length > 0) {
      // Use custom title/description or fall back to defaults
      const customTitle = customFile.title || docTitle;
      const customDescription = customFile.description || docDescription;
      
      // Generate the custom LLM file
      const customFilePath = path.join(outDir, customFile.filename);
      await generateLLMFile(
        customDocs,
        customFilePath,
        customTitle,
        customDescription,
        customFile.fullContent,
        customFile.version
      );
      
      console.log(`Generated custom LLM file: ${customFile.filename} with ${customDocs.length} documents`);
    } else {
      console.warn(`No matching documents found for custom LLM file: ${customFile.filename}`);
    }
  }
}

/**
 * Collect all document files from docs directory and optionally blog
 * @param context - Plugin context
 * @returns Array of file paths
 */
export async function collectDocFiles(context: PluginContext): Promise<string[]> {
  const { siteDir, docsDir, options } = context;
  const { ignoreFiles = [], includeBlog = false } = options;
  
  const allDocFiles: string[] = [];
  
  // Process docs directory
  const fullDocsDir = path.join(siteDir, docsDir);
  
  try {
    await fs.access(fullDocsDir);
    
    // Collect all markdown files from docs directory
    const docFiles = await readMarkdownFiles(fullDocsDir, siteDir, ignoreFiles);
    allDocFiles.push(...docFiles);
    
  } catch (err) {
    console.warn(`Docs directory not found: ${fullDocsDir}`);
  }
  
  // Process blog if enabled
  if (includeBlog) {
    const blogDir = path.join(siteDir, 'blog');
    
    try {
      await fs.access(blogDir);
      
      // Collect all markdown files from blog directory
      const blogFiles = await readMarkdownFiles(blogDir, siteDir, ignoreFiles);
      allDocFiles.push(...blogFiles);
      
    } catch (err) {
      console.warn(`Blog directory not found: ${blogDir}`);
    }
  }
  
  return allDocFiles;
} 