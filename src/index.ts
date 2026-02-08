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
import { PluginOptions, PluginContext, CustomLLMFile } from './types';
import { collectDocFiles, generateStandardLLMFiles, generateCustomLLMFiles } from './generator';
import { setLogLevel, LogLevel, logger } from './utils';

/**
 * Validates plugin options to ensure they conform to expected types and constraints
 * @param options - Plugin options to validate
 * @throws Error if any option is invalid
 */
function validatePluginOptions(options: PluginOptions): void {
  // Validate includeOrder
  if (options.includeOrder !== undefined) {
    if (!Array.isArray(options.includeOrder)) {
      throw new Error('includeOrder must be an array');
    }
    if (!options.includeOrder.every(item => typeof item === 'string')) {
      throw new Error('includeOrder must contain only strings');
    }
  }

  // Validate ignoreFiles
  if (options.ignoreFiles !== undefined) {
    if (!Array.isArray(options.ignoreFiles)) {
      throw new Error('ignoreFiles must be an array');
    }
    if (!options.ignoreFiles.every(item => typeof item === 'string')) {
      throw new Error('ignoreFiles must contain only strings');
    }
  }

  // Validate pathTransformation
  if (options.pathTransformation !== undefined) {
    if (typeof options.pathTransformation !== 'object' || options.pathTransformation === null) {
      throw new Error('pathTransformation must be an object');
    }

    const { ignorePaths, addPaths } = options.pathTransformation;

    if (ignorePaths !== undefined) {
      if (!Array.isArray(ignorePaths)) {
        throw new Error('pathTransformation.ignorePaths must be an array');
      }
      if (!ignorePaths.every(item => typeof item === 'string')) {
        throw new Error('pathTransformation.ignorePaths must contain only strings');
      }
    }

    if (addPaths !== undefined) {
      if (!Array.isArray(addPaths)) {
        throw new Error('pathTransformation.addPaths must be an array');
      }
      if (!addPaths.every(item => typeof item === 'string')) {
        throw new Error('pathTransformation.addPaths must contain only strings');
      }
    }
  }

  // Validate boolean options
  const booleanOptions = [
    'generateLLMsTxt',
    'generateLLMsFullTxt',
    'includeBlog',
    'includeUnmatchedLast',
    'excludeImports',
    'removeDuplicateHeadings',
    'generateMarkdownFiles',
    'preserveDirectoryStructure'
  ] as const;

  for (const option of booleanOptions) {
    if (options[option] !== undefined && typeof options[option] !== 'boolean') {
      throw new Error(`${option} must be a boolean`);
    }
  }

  // Validate string options
  const stringOptions = [
    'docsDir',
    'title',
    'description',
    'llmsTxtFilename',
    'llmsFullTxtFilename',
    'version',
    'rootContent',
    'fullRootContent'
  ] as const;

  for (const option of stringOptions) {
    if (options[option] !== undefined && typeof options[option] !== 'string') {
      throw new Error(`${option} must be a string`);
    }
  }

  // Validate keepFrontMatter
  if (options.keepFrontMatter !== undefined) {
    if (!Array.isArray(options.keepFrontMatter)) {
      throw new Error('keepFrontMatter must be an array');
    }
    if (!options.keepFrontMatter.every(item => typeof item === 'string')) {
      throw new Error('keepFrontMatter must contain only strings');
    }
  }

  // Validate logLevel
  if (options.logLevel !== undefined) {
    const validLogLevels = ['quiet', 'normal', 'verbose'];
    if (!validLogLevels.includes(options.logLevel)) {
      throw new Error(`logLevel must be one of: ${validLogLevels.join(', ')}`);
    }
  }

  // Validate customLLMFiles
  if (options.customLLMFiles !== undefined) {
    if (!Array.isArray(options.customLLMFiles)) {
      throw new Error('customLLMFiles must be an array');
    }

    options.customLLMFiles.forEach((file, index) => {
      if (typeof file !== 'object' || file === null) {
        throw new Error(`customLLMFiles[${index}] must be an object`);
      }

      // Required fields
      if (typeof file.filename !== 'string') {
        throw new Error(`customLLMFiles[${index}].filename must be a string`);
      }
      if (file.filename.trim() === '') {
        throw new Error(`customLLMFiles[${index}].filename cannot be empty`);
      }

      if (!Array.isArray(file.includePatterns)) {
        throw new Error(`customLLMFiles[${index}].includePatterns must be an array`);
      }
      if (!file.includePatterns.every(item => typeof item === 'string')) {
        throw new Error(`customLLMFiles[${index}].includePatterns must contain only strings`);
      }
      if (file.includePatterns.length === 0) {
        throw new Error(`customLLMFiles[${index}].includePatterns cannot be empty`);
      }

      if (typeof file.fullContent !== 'boolean') {
        throw new Error(`customLLMFiles[${index}].fullContent must be a boolean`);
      }

      // Optional fields
      if (file.title !== undefined && typeof file.title !== 'string') {
        throw new Error(`customLLMFiles[${index}].title must be a string`);
      }

      if (file.description !== undefined && typeof file.description !== 'string') {
        throw new Error(`customLLMFiles[${index}].description must be a string`);
      }

      if (file.ignorePatterns !== undefined) {
        if (!Array.isArray(file.ignorePatterns)) {
          throw new Error(`customLLMFiles[${index}].ignorePatterns must be an array`);
        }
        if (!file.ignorePatterns.every(item => typeof item === 'string')) {
          throw new Error(`customLLMFiles[${index}].ignorePatterns must contain only strings`);
        }
      }

      if (file.orderPatterns !== undefined) {
        if (!Array.isArray(file.orderPatterns)) {
          throw new Error(`customLLMFiles[${index}].orderPatterns must be an array`);
        }
        if (!file.orderPatterns.every(item => typeof item === 'string')) {
          throw new Error(`customLLMFiles[${index}].orderPatterns must contain only strings`);
        }
      }

      if (file.includeUnmatchedLast !== undefined && typeof file.includeUnmatchedLast !== 'boolean') {
        throw new Error(`customLLMFiles[${index}].includeUnmatchedLast must be a boolean`);
      }

      if (file.version !== undefined && typeof file.version !== 'string') {
        throw new Error(`customLLMFiles[${index}].version must be a string`);
      }

      if (file.rootContent !== undefined && typeof file.rootContent !== 'string') {
        throw new Error(`customLLMFiles[${index}].rootContent must be a string`);
      }
    });
  }
}

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
  // Validate options before processing
  validatePluginOptions(options);
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
    logLevel = 'normal',
  } = options;

  // Initialize logging level
  const logLevelMap = {
    quiet: LogLevel.QUIET,
    normal: LogLevel.NORMAL,
    verbose: LogLevel.VERBOSE,
  };
  setLogLevel(logLevelMap[logLevel] || LogLevel.NORMAL);

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
      logger.info('Generating LLM-friendly documentation...');
     
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
          logger.warn('No documents found to process. Skipping.');
          return;
        }
        
        // Process standard LLM files (llms.txt and llms-full.txt)
        await generateStandardLLMFiles(enhancedContext, allDocFiles);
        
        // Process custom LLM files
        await generateCustomLLMFiles(enhancedContext, allDocFiles);
        
        // Output overall statistics
        logger.info(`Stats: ${allDocFiles.length} total available documents processed`);
      } catch (err: any) {
        logger.error(`Error generating LLM documentation: ${err}`);
      }
    },
  };
}

export type { PluginOptions };