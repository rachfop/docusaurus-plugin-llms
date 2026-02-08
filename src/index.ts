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
import type { LoadContext, Plugin, Props, RouteConfig } from '@docusaurus/types';
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
    keepFrontMatter = [],
    rootContent,
    fullRootContent,
  } = options;

  const {
    siteDir,
    siteConfig,
    outDir,
  } = context;
  
  // Normalize baseUrl: remove trailing slash unless it's root '/'
  let normalizedBaseUrl = siteConfig.baseUrl || '/';
  if (normalizedBaseUrl !== '/' && normalizedBaseUrl.endsWith('/')) {
    normalizedBaseUrl = normalizedBaseUrl.slice(0, -1);
  }
  const siteUrl = siteConfig.url + normalizedBaseUrl;
  
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
      keepFrontMatter,
      rootContent,
      fullRootContent,
    }
  };

  return {
    name: 'docusaurus-plugin-llms',

    /**
     * Generates LLM-friendly documentation files after the build is complete
     */
    async postBuild(props?: Props & { content: unknown }): Promise<void> {
      console.log('Generating LLM-friendly documentation...');
     
      try {
        let enhancedContext = pluginContext;
        
        // If props are provided (Docusaurus 3.x+), use the resolved routes
        if (props?.routes) {
          // Create a map of file paths to their resolved URLs
          const routeMap = new Map<string, string>();
          
          // Helper function to recursively process routes
          const processRoutes = (routes: RouteConfig[]) => {
            routes.forEach(route => {
              if (route.path) {
                // Store the actual resolved path
                routeMap.set(route.path, route.path);
              }
              
              // Process nested routes recursively
              if (route.routes) {
                processRoutes(route.routes);
              }
            });
          };
          
          // Process all routes (cast to RouteConfig[] for recursive processing)
          processRoutes(props.routes as RouteConfig[]);
          
          // Pass the resolved routes to the plugin context
          enhancedContext = {
            ...pluginContext,
            routesPaths: props.routesPaths,
            routes: props.routes,
            routeMap,
          };
        }
        
        // Collect all document files
        const allDocFiles = await collectDocFiles(enhancedContext);
        
        // Skip further processing if no documents were found
        if (allDocFiles.length === 0) {
          console.warn('No documents found to process.');
          return;
        }
        
        // Process standard LLM files (llms.txt and llms-full.txt)
        await generateStandardLLMFiles(enhancedContext, allDocFiles);
        
        // Process custom LLM files
        await generateCustomLLMFiles(enhancedContext, allDocFiles);
        
        // Output overall statistics
        console.log(`Stats: ${allDocFiles.length} total available documents processed`);
      } catch (err: any) {
        console.error('Error generating LLM documentation:', err);
      }
    },
  };
}

export type { PluginOptions };