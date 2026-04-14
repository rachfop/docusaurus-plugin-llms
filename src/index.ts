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
import type { LoadContext, Plugin, Props } from '@docusaurus/types';
import { PluginOptions, PluginContext, CustomLLMFile, DocsSection } from './types';
import { collectDocFiles, generateStandardLLMFiles, generateCustomLLMFiles } from './generator';
import { setLogLevel, LogLevel, logger, getErrorMessage, isDefined, isNonEmptyString, isNonEmptyArray } from './utils';

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
  if (isDefined(options.pathTransformation)) {
    if (typeof options.pathTransformation !== 'object') {
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

  // Validate docsDir (string or array of section objects)
  if (options.docsDir !== undefined) {
    if (typeof options.docsDir !== 'string' && !Array.isArray(options.docsDir)) {
      throw new Error('docsDir must be a string or an array of section objects');
    }
    if (Array.isArray(options.docsDir)) {
      (options.docsDir as DocsSection[]).forEach((section, index) => {
        if (typeof section !== 'object' || section === null) {
          throw new Error(`docsDir[${index}] must be an object`);
        }
        if (typeof section.path !== 'string' || section.path.trim() === '') {
          throw new Error(`docsDir[${index}].path must be a non-empty string`);
        }
        if (typeof section.routeBasePath !== 'string' || section.routeBasePath.trim() === '') {
          throw new Error(`docsDir[${index}].routeBasePath must be a non-empty string`);
        }
        if (section.label !== undefined && (typeof section.label !== 'string' || section.label.trim() === '')) {
          throw new Error(`docsDir[${index}].label must be a non-empty string`);
        }
      });
    }
  }

  // Validate string options
  const stringOptions = [
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
      if (!isDefined(file) || typeof file !== 'object') {
        throw new Error(`customLLMFiles[${index}] must be an object`);
      }

      // Required fields
      if (!isNonEmptyString(file.filename)) {
        throw new Error(`customLLMFiles[${index}].filename must be a non-empty string`);
      }

      if (!isNonEmptyArray(file.includePatterns)) {
        throw new Error(`customLLMFiles[${index}].includePatterns must be a non-empty array`);
      }
      if (!file.includePatterns.every(item => typeof item === 'string')) {
        throw new Error(`customLLMFiles[${index}].includePatterns must contain only strings`);
      }

      if (typeof file.fullContent !== 'boolean') {
        throw new Error(`customLLMFiles[${index}].fullContent must be a boolean`);
      }

      // Optional fields
      if (isDefined(file.title) && !isNonEmptyString(file.title)) {
        throw new Error(`customLLMFiles[${index}].title must be a non-empty string`);
      }

      if (isDefined(file.description) && !isNonEmptyString(file.description)) {
        throw new Error(`customLLMFiles[${index}].description must be a non-empty string`);
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

      if (isDefined(file.version) && !isNonEmptyString(file.version)) {
        throw new Error(`customLLMFiles[${index}].version must be a non-empty string`);
      }

      if (isDefined(file.rootContent) && !isNonEmptyString(file.rootContent)) {
        throw new Error(`customLLMFiles[${index}].rootContent must be a non-empty string`);
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
    docsDir,
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
    preserveDirectoryStructure = true,
    processingBatchSize = 100,
    warnOnIgnoredFiles = false,
  } = options;

  // Normalize docsDir into docsSections array
  const docsSections: DocsSection[] =
    Array.isArray(docsDir) && docsDir.length > 0
      ? (docsDir as DocsSection[])
      : [{
          path: typeof docsDir === 'string' ? docsDir : 'docs',
          routeBasePath: typeof docsDir === 'string' ? docsDir : 'docs',
        }];

  // Resolved string form of docsDir for backward-compat fields
  const resolvedDocsDir = docsSections[0].path;

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
    docsDir: resolvedDocsDir,
    docTitle: title || siteConfig.title,
    docDescription: description || siteConfig.tagline || '',
    docsSections,
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
      preserveDirectoryStructure,
      processingBatchSize,
      warnOnIgnoredFiles,
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
        
        // If props are provided (Docusaurus 3.x+), pass the resolved route
        // paths so route resolution can match files to their actual URLs
        if (props?.routesPaths) {
          enhancedContext = {
            ...pluginContext,
            routesPaths: props.routesPaths,
          };
        }
        
        // Collect all document files
        const allDocFiles = await collectDocFiles(enhancedContext);
        
        // Skip further processing if no documents were found
        if (!isNonEmptyArray(allDocFiles)) {
          logger.warn('No documents found to process. Skipping.');
          return;
        }
        
        // Process standard LLM files (llms.txt and llms-full.txt)
        await generateStandardLLMFiles(enhancedContext, allDocFiles);
        
        // Process custom LLM files
        await generateCustomLLMFiles(enhancedContext, allDocFiles);
        
        // Output overall statistics
        logger.info(`Stats: ${allDocFiles.length} total available documents processed`);
      } catch (err: unknown) {
        logger.error(`Error generating LLM documentation: ${getErrorMessage(err)}`);
      }
    },
  };
}

export type { PluginOptions };