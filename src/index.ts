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
import {
  setLogLevel,
  withLogLevel,
  LogLevel,
  logger,
  getErrorMessage,
  isDefined,
  isNonEmptyString,
  isNonEmptyArray,
  isUnsafeOutputPath,
  buildImageAssetMap,
} from './utils';

/**
 * Reject an output path that could be written outside the build directory.
 * @param filePath - The configured filename or version path
 * @param label - Option name used in the error message
 * @throws Error if the path is absolute or has a `..` segment
 */
function validateOutputPath(filePath: string, label: string): void {
  if (isUnsafeOutputPath(filePath)) {
    throw new Error(
      `${label} '${filePath}' must be a relative path inside the build directory (no absolute paths or '..' segments)`,
    );
  }
}

/**
 * Collision key for an output filename: './llms.txt' and 'LLMS.txt' write the
 * same file as 'llms.txt' (case-insensitive filesystems included).
 */
function outputFileKey(filename: string): string {
  return path.posix.normalize(filename.replace(/\\/g, '/')).toLowerCase();
}

/**
 * Reject custom files whose filename matches a standard output or another
 * custom file in the same output directory, which would overwrite it.
 * @param customFiles - The customLLMFiles array to check
 * @param label - Option name used in error messages
 * @param standardFiles - Collision key → option label for the generated standard files
 */
function validateCustomFileCollisions(
  customFiles: CustomLLMFile[],
  label: string,
  standardFiles: Map<string, string>,
): void {
  const seen = new Map(standardFiles);
  customFiles.forEach((file, index) => {
    if (!isNonEmptyString(file?.filename)) return;
    const key = outputFileKey(file.filename);
    const existing = seen.get(key);
    if (existing !== undefined) {
      throw new Error(
        `${label}[${index}].filename '${file.filename}' collides with ${existing}; each generated file needs its own name`,
      );
    }
    seen.set(key, `${label}[${index}].filename`);
  });
}

/**
 * Validate an `includeOrder` value (top-level or per-version).
 * @param includeOrder - The value to check
 * @param label - Option name used in error messages
 */
function validateIncludeOrder(includeOrder: unknown, label: string): void {
  if (includeOrder === undefined) return;
  if (!Array.isArray(includeOrder)) {
    throw new Error(`${label} must be an array`);
  }
  if (!includeOrder.every((item) => typeof item === 'string')) {
    throw new Error(`${label} must contain only strings`);
  }
}

/**
 * Validate a `docsDir` value (top-level or per-version): a string or an
 * array of section objects.
 * @param docsDir - The value to check
 * @param label - Option name used in error messages
 */
function validateDocsDir(docsDir: unknown, label: string): void {
  if (docsDir === undefined) return;
  if (typeof docsDir !== 'string' && !Array.isArray(docsDir)) {
    throw new Error(`${label} must be a string or an array of section objects`);
  }
  if (Array.isArray(docsDir)) {
    (docsDir as DocsSection[]).forEach((section, index) => {
      if (typeof section !== 'object' || section === null) {
        throw new Error(`${label}[${index}] must be an object`);
      }
      if (typeof section.path !== 'string' || section.path.trim() === '') {
        throw new Error(`${label}[${index}].path must be a non-empty string`);
      }
      if (typeof section.routeBasePath !== 'string' || section.routeBasePath.trim() === '') {
        throw new Error(`${label}[${index}].routeBasePath must be a non-empty string`);
      }
      if (
        section.label !== undefined &&
        (typeof section.label !== 'string' || section.label.trim() === '')
      ) {
        throw new Error(`${label}[${index}].label must be a non-empty string`);
      }
    });
  }
}

/**
 * Validate a `customLLMFiles` value (top-level or per-version).
 * @param customLLMFiles - The value to check
 * @param label - Option name used in error messages
 */
function validateCustomLLMFiles(customLLMFiles: unknown, label: string): void {
  if (customLLMFiles === undefined) return;
  if (!Array.isArray(customLLMFiles)) {
    throw new Error(`${label} must be an array`);
  }

  (customLLMFiles as CustomLLMFile[]).forEach((file, index) => {
    const at = `${label}[${index}]`;
    if (!isDefined(file) || typeof file !== 'object') {
      throw new Error(`${at} must be an object`);
    }

    // Required fields
    if (!isNonEmptyString(file.filename)) {
      throw new Error(`${at}.filename must be a non-empty string`);
    }
    validateOutputPath(file.filename, `${at}.filename`);

    if (!isNonEmptyArray(file.includePatterns)) {
      throw new Error(`${at}.includePatterns must be a non-empty array`);
    }
    if (!file.includePatterns.every((item) => typeof item === 'string')) {
      throw new Error(`${at}.includePatterns must contain only strings`);
    }

    if (typeof file.fullContent !== 'boolean') {
      throw new Error(`${at}.fullContent must be a boolean`);
    }

    // Optional fields
    if (isDefined(file.title) && !isNonEmptyString(file.title)) {
      throw new Error(`${at}.title must be a non-empty string`);
    }

    if (isDefined(file.description) && !isNonEmptyString(file.description)) {
      throw new Error(`${at}.description must be a non-empty string`);
    }

    if (file.ignorePatterns !== undefined) {
      if (!Array.isArray(file.ignorePatterns)) {
        throw new Error(`${at}.ignorePatterns must be an array`);
      }
      if (!file.ignorePatterns.every((item) => typeof item === 'string')) {
        throw new Error(`${at}.ignorePatterns must contain only strings`);
      }
    }

    if (file.orderPatterns !== undefined) {
      if (!Array.isArray(file.orderPatterns)) {
        throw new Error(`${at}.orderPatterns must be an array`);
      }
      if (!file.orderPatterns.every((item) => typeof item === 'string')) {
        throw new Error(`${at}.orderPatterns must contain only strings`);
      }
    }

    if (file.includeUnmatchedLast !== undefined && typeof file.includeUnmatchedLast !== 'boolean') {
      throw new Error(`${at}.includeUnmatchedLast must be a boolean`);
    }

    if (isDefined(file.version) && !isNonEmptyString(file.version)) {
      throw new Error(`${at}.version must be a non-empty string`);
    }

    if (isDefined(file.rootContent) && !isNonEmptyString(file.rootContent)) {
      throw new Error(`${at}.rootContent must be a non-empty string`);
    }
  });
}

/**
 * Validates plugin options to ensure they conform to expected types and constraints
 * @param options - Plugin options to validate
 * @throws Error if any option is invalid
 */
function validatePluginOptions(options: PluginOptions): void {
  validateIncludeOrder(options.includeOrder, 'includeOrder');

  // Validate ignoreFiles
  if (options.ignoreFiles !== undefined) {
    if (!Array.isArray(options.ignoreFiles)) {
      throw new Error('ignoreFiles must be an array');
    }
    if (!options.ignoreFiles.every((item) => typeof item === 'string')) {
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
      if (!ignorePaths.every((item) => typeof item === 'string')) {
        throw new Error('pathTransformation.ignorePaths must contain only strings');
      }
    }

    if (addPaths !== undefined) {
      if (!Array.isArray(addPaths)) {
        throw new Error('pathTransformation.addPaths must be an array');
      }
      if (!addPaths.every((item) => typeof item === 'string')) {
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
    'addMdExtension',
    'warnOnIgnoredFiles',
    'rewriteImageUrls',
    'useRelativeUrls',
  ] as const;

  for (const option of booleanOptions) {
    if (options[option] !== undefined && typeof options[option] !== 'boolean') {
      throw new Error(`${option} must be a boolean`);
    }
  }

  validateDocsDir(options.docsDir, 'docsDir');

  // Validate string options
  const stringOptions = [
    'title',
    'description',
    'llmsTxtFilename',
    'llmsFullTxtFilename',
    'version',
    'rootContent',
    'fullRootContent',
    'blogDir',
    'blogRouteBasePath',
  ] as const;

  for (const option of stringOptions) {
    if (options[option] !== undefined && typeof options[option] !== 'string') {
      throw new Error(`${option} must be a string`);
    }
  }

  for (const option of ['llmsTxtFilename', 'llmsFullTxtFilename'] as const) {
    if (isNonEmptyString(options[option])) {
      validateOutputPath(options[option] as string, option);
    }
  }

  // Validate processingBatchSize: the batch loop advances by this value, so
  // 0, a negative number, or a non-integer would never terminate cleanly.
  if (
    options.processingBatchSize !== undefined &&
    !(Number.isInteger(options.processingBatchSize) && options.processingBatchSize > 0)
  ) {
    throw new Error('processingBatchSize must be a positive integer');
  }

  // Validate keepFrontMatter
  if (options.keepFrontMatter !== undefined) {
    if (!Array.isArray(options.keepFrontMatter)) {
      throw new Error('keepFrontMatter must be an array');
    }
    if (!options.keepFrontMatter.every((item) => typeof item === 'string')) {
      throw new Error('keepFrontMatter must contain only strings');
    }
  }

  // Validate preserveComponents
  if (options.preserveComponents !== undefined) {
    if (!Array.isArray(options.preserveComponents)) {
      throw new Error('preserveComponents must be an array');
    }
    if (!options.preserveComponents.every((item) => typeof item === 'string')) {
      throw new Error('preserveComponents must contain only strings');
    }
  }

  // Validate logLevel
  if (options.logLevel !== undefined) {
    const validLogLevels = ['quiet', 'normal', 'verbose'];
    if (!validLogLevels.includes(options.logLevel)) {
      throw new Error(`logLevel must be one of: ${validLogLevels.join(', ')}`);
    }
  }

  validateCustomLLMFiles(options.customLLMFiles, 'customLLMFiles');

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
          isDefined(version.path) ? (version.path as string) : version.name,
        );
        if (seenPaths.has(normalizedPath)) {
          throw new Error(
            `versions[${index}] resolves to path '${normalizedPath || '/'}', which collides with another version`,
          );
        }
        seenPaths.add(normalizedPath);
        validateOutputPath(
          normalizedPath,
          isDefined(version.path) ? `versions[${index}].path` : `versions[${index}].name`,
        );

        if (isDefined(version.routePrefix) && typeof version.routePrefix !== 'string') {
          throw new Error(`versions[${index}].routePrefix must be a string`);
        }
        // The same checks as the top-level options these fields override.
        validateDocsDir(
          isDefined(version.docsDir) ? version.docsDir : undefined,
          `versions[${index}].docsDir`,
        );
        validateCustomLLMFiles(
          isDefined(version.customLLMFiles) ? version.customLLMFiles : undefined,
          `versions[${index}].customLLMFiles`,
        );
        validateIncludeOrder(
          isDefined(version.includeOrder) ? version.includeOrder : undefined,
          `versions[${index}].includeOrder`,
        );
      });
    }
  }

  // Generated files sharing a name overwrite each other. Only files that are
  // actually generated count, so a disabled llms-full.txt may share a name.
  const standardFiles = new Map<string, string>();
  if (options.generateLLMsTxt !== false) {
    standardFiles.set(outputFileKey(options.llmsTxtFilename ?? 'llms.txt'), 'llmsTxtFilename');
  }
  if (options.generateLLMsFullTxt !== false) {
    const key = outputFileKey(options.llmsFullTxtFilename ?? 'llms-full.txt');
    if (standardFiles.has(key)) {
      throw new Error(
        `llmsFullTxtFilename '${options.llmsFullTxtFilename}' collides with llmsTxtFilename; each generated file needs its own name`,
      );
    }
    standardFiles.set(key, 'llmsFullTxtFilename');
  }
  // Each version writes its own subdirectory, so collisions are per version.
  if (Array.isArray(options.customLLMFiles)) {
    validateCustomFileCollisions(options.customLLMFiles, 'customLLMFiles', standardFiles);
  }
  if (Array.isArray(options.versions)) {
    options.versions.forEach((version, index) => {
      if (Array.isArray(version.customLLMFiles)) {
        validateCustomFileCollisions(
          version.customLLMFiles,
          `versions[${index}].customLLMFiles`,
          standardFiles,
        );
      }
    });
  }
}

/**
 * Normalize a version `path` into a bare subdirectory segment with no leading or
 * trailing slashes. The root version normalizes to '' (the site root).
 */
function normalizeVersionPath(rawPath: string): string {
  return rawPath.replace(/^\/+|\/+$/g, '');
}

/** Normalize a site-relative directory ('./docs/', 'docs\\x') for comparison. */
function normalizeSiteDir(dir: string): string {
  return path.posix.normalize(dir.replace(/\\/g, '/')).replace(/^(\.\/)+|\/+$/g, '');
}

/** A version whose defaults have been resolved against the top-level options. */
interface ResolvedVersion {
  name: string;
  label?: string;
  docsSections: DocsSection[];
  /** Bare output subdirectory ('' for the site root). */
  pathPrefix: string;
  /** Bare route prefix the version's links fall under ('' for none). */
  routePrefix: string;
  /** Whether the sections' routeBasePaths come from the Docusaurus docs config. */
  strictRouteScope: boolean;
  customLLMFiles?: CustomLLMFile[];
  includeOrder?: string[];
}

/** Normalize a `docsDir` value into sections, falling back to the top-level one. */
function toDocsSections(
  docsDir: string | DocsSection[] | undefined,
  fallback: DocsSection[],
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
  defaultDocsDir: string | DocsSection[] | undefined,
): ResolvedVersion[] {
  const { versions } = options;

  if (versions === undefined) {
    return [
      {
        name: 'default',
        label: isNonEmptyString(options.version) ? options.version : undefined,
        docsSections: defaultDocsSections,
        pathPrefix: '',
        routePrefix: '',
        strictRouteScope: false,
        customLLMFiles: options.customLLMFiles,
        includeOrder: options.includeOrder,
      },
    ];
  }

  const configs: VersionConfig[] =
    versions === 'auto' ? detectVersions(siteDir, siteConfig, defaultDocsDir) : versions;

  return configs.map((version) => {
    const pathPrefix = normalizeVersionPath(
      isDefined(version.path) ? (version.path as string) : version.name,
    );
    return {
      name: version.name,
      label: isNonEmptyString(version.label) ? version.label : version.name,
      docsSections: toDocsSections(version.docsDir, defaultDocsSections),
      pathPrefix,
      routePrefix: isDefined(version.routePrefix)
        ? normalizeVersionPath(version.routePrefix as string)
        : pathPrefix,
      strictRouteScope: versions === 'auto',
      customLLMFiles: version.customLLMFiles ?? options.customLLMFiles,
      includeOrder: version.includeOrder ?? options.includeOrder,
    };
  });
}

/**
 * Route roots a version owns, relative to the baseUrl: its route prefix, or
 * with no prefix, its sections' routeBasePaths.
 */
function getVersionRouteRoots(version: ResolvedVersion): string[] {
  if (version.routePrefix) return [`/${version.routePrefix}`];
  return version.docsSections
    .map((section) => `/${normalizeVersionPath(section.routeBasePath)}`)
    .filter((root) => root !== '/');
}

/** The options of one `@docusaurus/plugin-content-docs` instance used here. */
interface DocsPluginConfig {
  id: string;
  path: string;
  routeBasePath: string;
  versions: Record<string, { label?: string; path?: string }>;
  lastVersion?: string;
  includeCurrentVersion: boolean;
  onlyIncludeVersions?: string[];
  disableVersioning: boolean;
}

/**
 * Read the docs plugin instances from the site config, with Docusaurus's
 * defaults for unset options. The docs plugin may be configured through a
 * preset (`docs` options; the classic preset enables it unless `docs: false`)
 * or listed directly in `plugins`. With none found, returns the default
 * instance (`docs/` served at `/docs/`).
 */
function readDocsPluginConfigs(siteConfig: unknown): DocsPluginConfig[] {
  const configs: DocsPluginConfig[] = [];
  const add = (raw: unknown): void => {
    const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const versions: DocsPluginConfig['versions'] = {};
    if (o.versions && typeof o.versions === 'object') {
      for (const [id, cfg] of Object.entries(o.versions as Record<string, unknown>)) {
        const c = (cfg ?? {}) as { label?: unknown; path?: unknown };
        versions[id] = {
          label: typeof c.label === 'string' ? c.label : undefined,
          path: typeof c.path === 'string' ? c.path : undefined,
        };
      }
    }
    configs.push({
      id: isNonEmptyString(o.id) ? o.id : 'default',
      path: isNonEmptyString(o.path) ? o.path : 'docs',
      routeBasePath: typeof o.routeBasePath === 'string' ? o.routeBasePath : 'docs',
      versions,
      lastVersion: isNonEmptyString(o.lastVersion) ? o.lastVersion : undefined,
      includeCurrentVersion: o.includeCurrentVersion !== false,
      onlyIncludeVersions: Array.isArray(o.onlyIncludeVersions)
        ? o.onlyIncludeVersions.filter((id): id is string => typeof id === 'string')
        : undefined,
      disableVersioning: o.disableVersioning === true,
    });
  };

  // A preset or plugin entry is a name, or a [name, options] tuple.
  const split = (entry: unknown): [unknown, unknown] =>
    Array.isArray(entry) ? [entry[0], entry[1]] : [entry, undefined];
  const cfg = siteConfig as { presets?: unknown[]; plugins?: unknown[] } | undefined;
  for (const entry of cfg?.presets ?? []) {
    const [name, opts] = split(entry);
    const docs = (opts as { docs?: unknown } | undefined)?.docs;
    if (docs && typeof docs === 'object') add(docs);
    else if (docs === undefined && typeof name === 'string' && name.includes('classic')) add({});
  }
  for (const entry of cfg?.plugins ?? []) {
    const [name, opts] = split(entry);
    if (typeof name === 'string' && name.includes('plugin-content-docs')) add(opts);
  }
  if (configs.length === 0) add({});
  return configs;
}

/**
 * Detect versions from Docusaurus docs versioning the way the default docs
 * plugin instance builds them (plugin-content-docs `readVersionsMetadata`):
 * - the version list is `versions.json` with `current` first unless
 *   `includeCurrentVersion: false`, filtered by `onlyIncludeVersions`
 * - the last version is `lastVersion`, else the newest entry of
 *   `versions.json`, else `current`
 * - a version is served at `/<routeBasePath>/<versionPath>/`, where the
 *   version path is its configured `path`, else '' for the last version,
 *   'next' for `current`, and the version name otherwise
 * Each version writes its files under `<outDir>/<versionPath>/`, so the version
 * served at the unprefixed route owns the root files.
 */
function detectVersions(
  siteDir: string,
  siteConfig: unknown,
  defaultDocsDir: string | DocsSection[] | undefined,
): VersionConfig[] {
  const docsConfig =
    readDocsPluginConfigs(siteConfig).find((c) => c.id === 'default') ??
    readDocsPluginConfigs(undefined)[0];

  let versionedIds: string[] = [];
  if (!docsConfig.disableVersioning) {
    try {
      const raw = fs.readFileSync(path.join(siteDir, 'versions.json'), 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        versionedIds = parsed.filter((id): id is string => typeof id === 'string');
      }
    } catch {
      // No versions.json — only the current (unversioned) docs exist.
    }
  }

  let names = [...versionedIds];
  if (docsConfig.includeCurrentVersion && !names.includes('current')) {
    names.unshift('current');
  }
  const { onlyIncludeVersions } = docsConfig;
  if (onlyIncludeVersions) {
    names = names.filter((name) => onlyIncludeVersions.includes(name));
  }
  const lastVersionName =
    docsConfig.lastVersion ?? names.find((name) => name !== 'current') ?? 'current';
  const routeBase = normalizeVersionPath(docsConfig.routeBasePath);

  return names.map((name) => {
    const meta = docsConfig.versions[name] ?? {};
    const defaultPath = name === lastVersionName ? '' : name === 'current' ? 'next' : name;
    const versionPath = normalizeVersionPath(meta.path ?? defaultPath);
    const withVersion = (base: string): string =>
      [normalizeVersionPath(base), versionPath].filter(Boolean).join('/') || '/';

    let docsDir: DocsSection[];
    if (name !== 'current') {
      docsDir = [{ path: `versioned_docs/version-${name}`, routeBasePath: withVersion(routeBase) }];
    } else if (Array.isArray(defaultDocsDir) && defaultDocsDir.length > 0) {
      // Only the section holding the docs plugin's own directory is versioned.
      docsDir = defaultDocsDir.map((section) =>
        normalizeSiteDir(section.path) === normalizeSiteDir(docsConfig.path)
          ? { ...section, routeBasePath: withVersion(section.routeBasePath) }
          : section,
      );
    } else {
      docsDir = [
        {
          path: typeof defaultDocsDir === 'string' ? defaultDocsDir : docsConfig.path,
          routeBasePath: withVersion(routeBase),
        },
      ];
    }

    return { name, label: meta.label, docsDir, path: versionPath, routePrefix: '' };
  });
}

/**
 * Localized content directories for a non-default locale, following
 * Docusaurus's i18n layout: docs from
 * `<localizationDir>/docusaurus-plugin-content-docs[-<pluginId>]/<current|version-<name>>/`
 * (plugin-content-docs `getDocsDirPathLocalized`) and blog posts from
 * `<localizationDir>/docusaurus-plugin-content-blog/`. A section maps to a docs
 * plugin instance by its directory: `[<pluginId>_]versioned_docs/version-<name>`
 * or an instance's `path`.
 */
function getLocalizedDirs(
  siteDir: string,
  localizationDir: string,
  docsConfigs: DocsPluginConfig[],
  sections: DocsSection[],
  blogDir: string | undefined,
): Array<{ sourceDir: string; localizedDir: string }> {
  const dirs: Array<{ sourceDir: string; localizedDir: string }> = [];
  const docsPluginDir = (id: string): string =>
    `docusaurus-plugin-content-docs${id === 'default' ? '' : `-${id}`}`;

  for (const section of sections) {
    const sectionDir = normalizeSiteDir(section.path);
    const versioned = /^(?:(.+)_)?versioned_docs\/version-(.+)$/.exec(sectionDir);
    let localizedDir: string | undefined;
    if (versioned) {
      localizedDir = path.join(
        localizationDir,
        docsPluginDir(versioned[1] ?? 'default'),
        `version-${versioned[2]}`,
      );
    } else {
      const docsConfig = docsConfigs.find((c) => normalizeSiteDir(c.path) === sectionDir);
      if (docsConfig) {
        localizedDir = path.join(localizationDir, docsPluginDir(docsConfig.id), 'current');
      }
    }
    if (localizedDir) dirs.push({ sourceDir: path.join(siteDir, section.path), localizedDir });
  }

  if (blogDir !== undefined) {
    dirs.push({
      sourceDir: path.join(siteDir, blogDir),
      localizedDir: path.join(localizationDir, 'docusaurus-plugin-content-blog'),
    });
  }
  return dirs;
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
  options: PluginOptions = {},
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
    blogDir = 'blog',
    blogRouteBasePath = 'blog',
    pathTransformation,
    includeOrder = [],
    includeUnmatchedLast = true,
    version,
    customLLMFiles = [],
    excludeImports = false,
    removeDuplicateHeadings = false,
    preserveComponents = [],
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
      : [
          {
            path: typeof docsDir === 'string' ? docsDir : 'docs',
            routeBasePath: typeof docsDir === 'string' ? docsDir : 'docs',
          },
        ];

  // Resolved string form of docsDir for backward-compat fields
  const resolvedDocsDir = docsSections[0].path;

  // Initialize logging level
  const logLevelMap = {
    quiet: LogLevel.QUIET,
    normal: LogLevel.NORMAL,
    verbose: LogLevel.VERBOSE,
  };
  // `??`, not `||`: LogLevel.QUIET is 0, which `||` would turn into NORMAL.
  const instanceLogLevel = logLevelMap[logLevel] ?? LogLevel.NORMAL;
  setLogLevel(instanceLogLevel);

  const { siteDir, siteConfig, outDir } = context;

  // A non-default locale reads translated docs and blog posts from the
  // locale's localization directory, as Docusaurus does when the locale has
  // `translate` enabled (the default when i18n/<locale> exists).
  const { i18n, localizationDir } = context as Partial<
    Pick<LoadContext, 'i18n' | 'localizationDir'>
  >;
  const currentLocale = i18n?.currentLocale;
  const localeConfig = (
    i18n?.localeConfigs as Record<string, { translate?: boolean }> | undefined
  )?.[currentLocale ?? ''];
  const translatedLocaleDir =
    isNonEmptyString(currentLocale) &&
    currentLocale !== i18n?.defaultLocale &&
    localeConfig?.translate !== false
      ? (localizationDir ?? path.join(siteDir, 'i18n', currentLocale))
      : undefined;

  // Normalize baseUrl: remove trailing slash unless it's root '/'
  let normalizedBaseUrl = siteConfig.baseUrl || '/';
  if (normalizedBaseUrl !== '/' && normalizedBaseUrl.endsWith('/')) {
    normalizedBaseUrl = normalizedBaseUrl.slice(0, -1);
  }
  // A trailing slash on siteConfig.url would double up with baseUrl
  // ('https://site.com/' + '/docs' → 'https://site.com//docs') and leak '//'
  // into every generated URL, mismatching sitemap.xml.
  const normalizedSiteUrl = (siteConfig.url || '').replace(/\/+$/, '');
  const siteUrl = normalizedSiteUrl + normalizedBaseUrl;

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
      blogDir,
      blogRouteBasePath,
      pathTransformation,
      includeOrder,
      includeUnmatchedLast,
      version,
      customLLMFiles,
      excludeImports,
      removeDuplicateHeadings,
      preserveComponents,
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
    },
  };

  return {
    name: 'docusaurus-plugin-llms',

    /**
     * Generates LLM-friendly documentation files after the build is complete
     */
    async postBuild(props?: Props & { content: unknown }): Promise<void> {
      // Run under this instance's own logLevel: Docusaurus runs every plugin's
      // postBuild concurrently, so the module-wide level may be another
      // instance's.
      return withLogLevel(instanceLogLevel, async () => {
        logger.info('Generating LLM-friendly documentation...');

        try {
          const routesPaths = props?.routesPaths;
          if (routesPaths) {
            logger.verbose(
              `routesPaths available: ${routesPaths.length} routes — sample: ${routesPaths.slice(0, 5).join(', ')}`,
            );
          } else {
            logger.verbose(
              'routesPaths NOT available in postBuild props — URL resolution will use file-path fallback',
            );
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
            docsDir,
          );
          const isMultiVersion = options.versions !== undefined;
          // In versions mode the blog belongs to the version written at the
          // build root (or the first version when none is).
          const blogVersion =
            resolvedVersions.find((v) => v.pathPrefix === '') ?? resolvedVersions[0];
          const docsConfigs = translatedLocaleDir ? readDocsPluginConfigs(siteConfig) : [];

          for (const version of resolvedVersions) {
            // Each version owns route roots; other versions skip routes under
            // them so links don't leak into another version's subtree. A root
            // that contains this version's own routes isn't excluded.
            const ownRoots = getVersionRouteRoots(version);
            const siblingPrefixes = resolvedVersions
              .filter((other) => other !== version)
              .flatMap(getVersionRouteRoots)
              .filter(
                (root) => !ownRoots.some((own) => own === root || own.startsWith(`${root}/`)),
              );
            const versionIncludeBlog = includeBlog && (!isMultiVersion || version === blogVersion);
            const versionContext: PluginContext = {
              ...pluginContext,
              routesPaths,
              imageAssetMap,
              docsSections: version.docsSections,
              docsDir: version.docsSections[0].path,
              outputSubdir: version.pathPrefix,
              markdownPaths: { usedPaths: new Set(), docPaths: new Map() },
              // Only scope routes in multi-version mode; the single default
              // version keeps the original whole-site matching behavior.
              routePrefix: isMultiVersion
                ? version.routePrefix
                  ? `/${version.routePrefix}`
                  : ''
                : undefined,
              siblingPrefixes: isMultiVersion ? siblingPrefixes : undefined,
              strictRouteScope: version.strictRouteScope || undefined,
              localizedDirs: translatedLocaleDir
                ? getLocalizedDirs(
                    siteDir,
                    translatedLocaleDir,
                    docsConfigs,
                    version.docsSections,
                    versionIncludeBlog ? blogDir : undefined,
                  )
                : undefined,
              options: {
                ...pluginContext.options,
                includeBlog: versionIncludeBlog,
                version: version.label,
                customLLMFiles: version.customLLMFiles,
                includeOrder: version.includeOrder,
              },
            };

            if (isMultiVersion) {
              logger.info(
                `Generating LLM files for version '${version.name}'` + ` -> /${version.pathPrefix}`,
              );
            }

            // A failing version is logged and skipped so the others still
            // generate.
            try {
              const allDocFiles = await collectDocFiles(versionContext);
              if (!isNonEmptyArray(allDocFiles)) {
                logger.warn(`No documents found for version '${version.name}'. Skipping.`);
                continue;
              }

              await generateStandardLLMFiles(versionContext, allDocFiles);
              await generateCustomLLMFiles(versionContext, allDocFiles);

              logger.info(
                `Stats: ${allDocFiles.length} documents processed` +
                  (isMultiVersion ? ` for version '${version.name}'` : ''),
              );
            } catch (err: unknown) {
              if (!isMultiVersion) throw err;
              logger.error(
                `Error generating LLM documentation for version '${version.name}': ${getErrorMessage(err)}`,
              );
            }
          }
        } catch (err: unknown) {
          logger.error(`Error generating LLM documentation: ${getErrorMessage(err)}`);
        }
      });
    },
  };
}

export type { PluginOptions };
