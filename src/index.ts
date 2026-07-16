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
import * as fs from 'fs';
import type { LoadContext, Plugin, Props } from '@docusaurus/types';
import { PluginOptions, PluginContext, CustomLLMFile, DocsSection, VersionConfig } from './types';
import { collectDocFiles, generateStandardLLMFiles, generateCustomLLMFiles } from './generator';
import { setLogLevel, LogLevel, logger, getErrorMessage, isDefined, isNonEmptyString, isNonEmptyArray, buildImageAssetMap } from './utils';

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
    'preserveDirectoryStructure',
    'addMdExtension'
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

  // Validate versions
  if (options.versions !== undefined) {
    if (options.versions !== 'auto' && !Array.isArray(options.versions)) {
      throw new Error("versions must be an array of version objects or 'auto'");
    }
    if (Array.isArray(options.versions)) {
      if (options.versions.length === 0) {
        throw new Error('versions must contain at least one version object');
      }
      const seenNames = new Set<string>();
      const seenPaths = new Set<string>();
      options.versions.forEach((version, index) => {
        if (typeof version !== 'object' || version === null) {
          throw new Error(`versions[${index}] must be an object`);
        }
        if (!isNonEmptyString(version.name)) {
          throw new Error(`versions[${index}].name must be a non-empty string`);
        }
        if (seenNames.has(version.name)) {
          throw new Error(`versions[${index}].name '${version.name}' is duplicated`);
        }
        seenNames.add(version.name);

        if (isDefined(version.label) && !isNonEmptyString(version.label)) {
          throw new Error(`versions[${index}].label must be a non-empty string`);
        }
        if (isDefined(version.path) && typeof version.path !== 'string') {
          throw new Error(`versions[${index}].path must be a string`);
        }
        // Two versions writing to the same subdirectory would clobber each other.
        const normalizedPath = normalizeVersionPath(
          isDefined(version.path) ? (version.path as string) : version.name
        );
        if (seenPaths.has(normalizedPath)) {
          throw new Error(
            `versions[${index}] resolves to path '${normalizedPath || '/'}', which collides with another version`
          );
        }
        seenPaths.add(normalizedPath);

        if (
          isDefined(version.docsDir) &&
          typeof version.docsDir !== 'string' &&
          !Array.isArray(version.docsDir)
        ) {
          throw new Error(
            `versions[${index}].docsDir must be a string or an array of section objects`
          );
        }
        if (isDefined(version.customLLMFiles) && !Array.isArray(version.customLLMFiles)) {
          throw new Error(`versions[${index}].customLLMFiles must be an array`);
        }
        if (isDefined(version.includeOrder) && !Array.isArray(version.includeOrder)) {
          throw new Error(`versions[${index}].includeOrder must be an array`);
        }
      });
    }
  }
}

/**
 * Normalize a version `path` into a bare subdirectory segment with no leading or
 * trailing slashes. The root version normalizes to '' (the site root).
 */
function normalizeVersionPath(rawPath: string): string {
  return rawPath.replace(/^\/+|\/+$/g, '');
}

/** A version whose defaults have been resolved against the top-level options. */
interface ResolvedVersion {
  name: string;
  label?: string;
  docsSections: DocsSection[];
  /** Bare output subdirectory / route prefix ('' for the site root). */
  pathPrefix: string;
  customLLMFiles?: CustomLLMFile[];
  includeOrder?: string[];
}

/** Normalize a `docsDir` value into sections, falling back to the top-level one. */
function toDocsSections(
  docsDir: string | DocsSection[] | undefined,
  fallback: DocsSection[]
): DocsSection[] {
  if (docsDir === undefined) return fallback;
  if (Array.isArray(docsDir)) {
    return docsDir.length > 0 ? docsDir : fallback;
  }
  return [{ path: docsDir, routeBasePath: docsDir }];
}

/**
 * Resolve the effective list of versions to generate. With no `versions` option
 * this is a single root version reproducing the plugin's default behavior; an
 * explicit array is used as-is; `'auto'` is detected from Docusaurus versioning.
 * Each version inherits any unset field from the top-level options.
 */
function resolveVersions(
  options: PluginOptions,
  siteDir: string,
  siteConfig: unknown,
  defaultDocsSections: DocsSection[],
  defaultDocsDir: string | DocsSection[] | undefined
): ResolvedVersion[] {
  const { versions } = options;

  if (versions === undefined) {
    return [
      {
        name: 'default',
        label: isNonEmptyString(options.version) ? options.version : undefined,
        docsSections: defaultDocsSections,
        pathPrefix: '',
        customLLMFiles: options.customLLMFiles,
        includeOrder: options.includeOrder,
      },
    ];
  }

  const configs: VersionConfig[] =
    versions === 'auto'
      ? detectVersions(siteDir, siteConfig, defaultDocsDir)
      : versions;

  return configs.map(version => ({
    name: version.name,
    label: isNonEmptyString(version.label) ? version.label : version.name,
    docsSections: toDocsSections(version.docsDir, defaultDocsSections),
    pathPrefix: normalizeVersionPath(
      isDefined(version.path) ? (version.path as string) : version.name
    ),
    customLLMFiles: version.customLLMFiles ?? options.customLLMFiles,
    includeOrder: version.includeOrder ?? options.includeOrder,
  }));
}

/**
 * Read per-version label/path metadata from the Docusaurus docs config. The docs
 * plugin may be configured via a preset or listed directly in `plugins`; both are
 * scanned. Returns an empty map when nothing is found (best effort).
 */
function readDocsVersionMeta(
  siteConfig: unknown
): Record<string, { label?: string; path?: string }> {
  const meta: Record<string, { label?: string; path?: string }> = {};
  const collect = (versions: unknown): void => {
    if (!versions || typeof versions !== 'object') return;
    for (const [id, cfg] of Object.entries(versions as Record<string, unknown>)) {
      const c = (cfg ?? {}) as { label?: unknown; path?: unknown };
      meta[id] = {
        label: typeof c.label === 'string' ? c.label : undefined,
        path: typeof c.path === 'string' ? c.path : undefined,
      };
    }
  };

  const cfg = siteConfig as { presets?: unknown[]; plugins?: unknown[] };
  const scanEntry = (entry: unknown): void => {
    if (!Array.isArray(entry)) return;
    const opts = entry[1] as { docs?: { versions?: unknown }; versions?: unknown } | undefined;
    // Presets nest docs options under `docs`; a standalone content-docs plugin
    // holds `versions` at the top level of its options object.
    collect(opts?.docs?.versions);
    collect(opts?.versions);
  };
  (cfg?.presets ?? []).forEach(scanEntry);
  (cfg?.plugins ?? []).forEach(scanEntry);
  return meta;
}

/**
 * Detect versions from Docusaurus docs versioning: the current (unversioned)
 * docs plus every entry in `versions.json` (sourced from
 * `versioned_docs/version-<id>`). Labels and route paths come from the docs
 * config when available, otherwise sensible defaults.
 */
function detectVersions(
  siteDir: string,
  siteConfig: unknown,
  defaultDocsDir: string | DocsSection[] | undefined
): VersionConfig[] {
  let versionedIds: string[] = [];
  try {
    const raw = fs.readFileSync(path.join(siteDir, 'versions.json'), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      versionedIds = parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch {
    // No versions.json — only the current (unversioned) docs exist.
  }

  const versionMeta = readDocsVersionMeta(siteConfig);
  const configs: VersionConfig[] = [];

  const currentMeta = versionMeta['current'] ?? {};
  configs.push({
    name: 'current',
    label: currentMeta.label,
    docsDir: defaultDocsDir ?? 'docs',
    path: normalizeVersionPath(currentMeta.path ?? ''),
  });

  for (const id of versionedIds) {
    const idMeta = versionMeta[id] ?? {};
    configs.push({
      name: id,
      label: idMeta.label,
      docsDir: `versioned_docs/version-${id}`,
      path: normalizeVersionPath(idMeta.path ?? id),
    });
  }

  return configs;
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
    version,
    customLLMFiles = [],
    excludeImports = false,
    removeDuplicateHeadings = false,
    generateMarkdownFiles = false,
    keepFrontMatter = [],
    rootContent,
    fullRootContent,
    addMdExtension = true,
    logLevel = 'normal',
    preserveDirectoryStructure = true,
    processingBatchSize = 100,
    warnOnIgnoredFiles = false,
    rewriteImageUrls = false,
    useRelativeUrls = false,
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
      version,
      customLLMFiles,
      excludeImports,
      removeDuplicateHeadings,
      generateMarkdownFiles,
      keepFrontMatter,
      rootContent,
      fullRootContent,
      addMdExtension,
      preserveDirectoryStructure,
      processingBatchSize,
      warnOnIgnoredFiles,
      rewriteImageUrls,
      useRelativeUrls,
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
        const routesPaths = props?.routesPaths;
        if (routesPaths) {
          logger.verbose(`routesPaths available: ${routesPaths.length} routes — sample: ${routesPaths.slice(0, 5).join(', ')}`);
        } else {
          logger.verbose('routesPaths NOT available in postBuild props — URL resolution will use file-path fallback');
        }

        // Build the image asset map once when rewriteImageUrls is enabled; it is
        // keyed off the build output and shared across all versions.
        let imageAssetMap: Map<string, string[]> | undefined;
        if (rewriteImageUrls) {
          logger.verbose('Building image asset map for URL rewriting...');
          imageAssetMap = await buildImageAssetMap(pluginContext.outDir);
          logger.verbose(`Image asset map: ${imageAssetMap.size} unique image basenames indexed`);
        }

        const resolvedVersions = resolveVersions(
          options,
          siteDir,
          siteConfig,
          docsSections,
          docsDir
        );
        // Non-root versions each own a route-path prefix; the root version
        // excludes these so its links don't leak into a versioned subtree.
        const otherPrefixes = resolvedVersions
          .map(v => v.pathPrefix)
          .filter(prefix => prefix !== '');
        const isMultiVersion = options.versions !== undefined;

        for (const version of resolvedVersions) {
          const routePrefix = version.pathPrefix ? `/${version.pathPrefix}` : '';
          const versionContext: PluginContext = {
            ...pluginContext,
            routesPaths,
            imageAssetMap,
            docsSections: version.docsSections,
            docsDir: version.docsSections[0].path,
            outputSubdir: version.pathPrefix,
            // Only scope routes in multi-version mode; the single default
            // version keeps the original whole-site matching behavior.
            routePrefix: isMultiVersion ? routePrefix : undefined,
            siblingPrefixes: isMultiVersion
              ? otherPrefixes
                  .filter(prefix => prefix !== version.pathPrefix)
                  .map(prefix => `/${prefix}`)
              : undefined,
            options: {
              ...pluginContext.options,
              version: version.label,
              customLLMFiles: version.customLLMFiles,
              includeOrder: version.includeOrder,
            },
          };

          if (isMultiVersion) {
            logger.info(
              `Generating LLM files for version '${version.name}'` +
                ` -> /${version.pathPrefix}`
            );
          }

          const allDocFiles = await collectDocFiles(versionContext);
          if (!isNonEmptyArray(allDocFiles)) {
            logger.warn(
              `No documents found for version '${version.name}'. Skipping.`
            );
            continue;
          }

          await generateStandardLLMFiles(versionContext, allDocFiles);
          await generateCustomLLMFiles(versionContext, allDocFiles);

          logger.info(
            `Stats: ${allDocFiles.length} documents processed` +
              (isMultiVersion ? ` for version '${version.name}'` : '')
          );
        }
      } catch (err: unknown) {
        logger.error(`Error generating LLM documentation: ${getErrorMessage(err)}`);
      }
    },
  };
}

export type { PluginOptions };