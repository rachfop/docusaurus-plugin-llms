/**
 * @fileoverview Docusaurus plugin that generates LLM-friendly documentation following the llmstxt.org standard.
 * 
 * This plugin creates two files:
 * - llms.txt: Contains links to all sections of documentation
 * - llms-full.txt: Contains all documentation content in a single file
 * 
 * The plugin runs during the Docusaurus build process and scans all Markdown files in the docs directory.
 */

import * as path from 'path';
import type { LoadContext, Plugin } from '@docusaurus/types';
import { PluginOptions, PluginContext } from './types';
import { collectDocFiles, generateStandardLLMFiles, generateCustomLLMFiles } from './generator';

/**
 * A Docusaurus plugin to generate LLM-friendly documentation following
 * the llmstxt.org standard
 * 
 * @param context - Docusaurus context
 * @param options - Plugin options
 * @returns Plugin object
 */
export default function docusaurusPluginLLMs(
  context: LoadContext,
  options: PluginOptions = {}
): Plugin<void> {
  // Set default options
  const {
    generateLLMsTxt = true,
    generateLLMsFullTxt = true,
    docsDir = 'docs',
    ignoreFiles = [],
    title,
    description,
    llmsTxtFilename = 'llms.txt',
    llmsFullTxtFilename = 'llms-full.txt',
    includeBlog = false,
    pathTransformation,
    includeOrder = [],
    includeUnmatchedLast = true,
    customLLMFiles = [],
    excludeImports = false,
    removeDuplicateHeadings = false,
    generateMarkdownFiles = false,
  } = options;

  const {
    siteDir,
    siteConfig,
    outDir,
  } = context;
  
  // Build the site URL with proper trailing slash
  const siteUrl = siteConfig.url + (
    siteConfig.baseUrl.endsWith('/') 
      ? siteConfig.baseUrl.slice(0, -1) 
      : siteConfig.baseUrl || ''
  );
  
  // Create a plugin context object with processed options
  const pluginContext: PluginContext = {
    siteDir,
    outDir,
    siteUrl,
    docsDir,
    docTitle: title || siteConfig.title,
    docDescription: description || siteConfig.tagline || '',
    options: {
      generateLLMsTxt,
      generateLLMsFullTxt,
      docsDir,
      ignoreFiles,
      title,
      description,
      llmsTxtFilename,
      llmsFullTxtFilename,
      includeBlog,
      pathTransformation,
      includeOrder,
      includeUnmatchedLast,
      customLLMFiles,
      excludeImports,
      removeDuplicateHeadings,
      generateMarkdownFiles,
    }
  };

  return {
    name: 'docusaurus-plugin-llms',

    /**
     * Generates LLM-friendly documentation files after the build is complete
     */
    async postBuild(): Promise<void> {
      console.log('Generating LLM-friendly documentation...');
     
      try {
        // Collect all document files
        const allDocFiles = await collectDocFiles(pluginContext);
        
        // Skip further processing if no documents were found
        if (allDocFiles.length === 0) {
          console.warn('No documents found to process.');
          return;
        }
        
        // Process standard LLM files (llms.txt and llms-full.txt)
        await generateStandardLLMFiles(pluginContext, allDocFiles);
        
        // Process custom LLM files
        await generateCustomLLMFiles(pluginContext, allDocFiles);
        
        // Output overall statistics
        console.log(`Stats: ${allDocFiles.length} total available documents processed`);
      } catch (err: any) {
        console.error('Error generating LLM documentation:', err);
      }
    },
  };
}

export type { PluginOptions };