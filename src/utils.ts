/**
 * Utility functions for the docusaurus-plugin-llms plugin
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { minimatch } from 'minimatch';
import { PluginOptions } from './types';
import {
  isDefined,
  isNonEmptyString,
  isNonEmptyArray,
  getErrorMessage,
  ValidationError,
  validateRequired,
  validateString
} from './guards';
import { logger } from './logger';

// Re-export the focused modules so existing `./utils` imports keep working.
export * from './guards';
export * from './numberPrefix';
export * from './logger';
export * from './files';
export * from './content';
export * from './images';

/**
 * Constants for path length limits
 */
const MAX_PATH_LENGTH_WINDOWS = 260;
const MAX_PATH_LENGTH_UNIX = 4096;

/**
 * Normalizes a file path by converting all backslashes to forward slashes.
 * This ensures consistent path handling across Windows and Unix systems.
 *
 * @param filePath - The file path to normalize
 * @returns The normalized path with forward slashes
 * @throws ValidationError if filePath is not a string
 */
export function normalizePath(filePath: string): string {
  validateString(filePath, 'filePath');
  return filePath.replace(/\\/g, '/');
}

/**
 * Validates that a file path does not exceed the platform-specific maximum length
 * @param filePath - The file path to validate
 * @returns True if the path is within limits, false otherwise
 */
export function validatePathLength(filePath: string): boolean {
  const maxLength = process.platform === 'win32'
    ? MAX_PATH_LENGTH_WINDOWS
    : MAX_PATH_LENGTH_UNIX;

  if (filePath.length > maxLength) {
    logger.error(`Path exceeds maximum length (${maxLength}): ${filePath}`);
    return false;
  }
  return true;
}

/**
 * Shortens a file path by creating a hash-based filename if the path is too long
 * @param fullPath - The full file path that may be too long
 * @param outputDir - The output directory base path
 * @param relativePath - The relative path from the output directory
 * @returns A shortened path if necessary, or the original path if it's within limits
 */
export function shortenPathIfNeeded(
  fullPath: string,
  outputDir: string,
  relativePath: string
): string {
  if (validatePathLength(fullPath)) {
    return fullPath;
  }

  // Create a hash of the relative path to ensure uniqueness
  const hash = crypto.createHash('md5').update(relativePath).digest('hex').substring(0, 8);
  const shortenedPath = path.join(outputDir, `${hash}.md`);

  logger.warn(`Path too long, using shortened path: ${shortenedPath}`);
  logger.verbose(`Original path: ${fullPath}`);

  return shortenedPath;
}

/**
 * Check if a file should be ignored based on glob patterns
 * Matches against both site-relative and docs-relative paths
 * @param filePath - Path to the file
 * @param baseDir - Base directory (site root) for relative paths
 * @param ignorePatterns - Glob patterns for files to ignore
 * @param docsDir - Docs directory name (e.g., 'docs')
 * @returns Whether the file should be ignored
 */
export function shouldIgnoreFile(filePath: string, baseDir: string, ignorePatterns: string[], docsDir: string = 'docs'): boolean {
  if (!isNonEmptyArray(ignorePatterns)) {
    return false;
  }

  const minimatchOptions = { matchBase: true };

  // Get site-relative path (e.g., "docs/quickstart/file.md")
  const siteRelativePath = normalizePath(path.relative(baseDir, filePath));

  // Get docs-relative path (e.g., "quickstart/file.md")
  const docsBaseDir = path.resolve(path.join(baseDir, docsDir));
  const resolvedFile = path.resolve(filePath);
  const docsRelativePath = resolvedFile.startsWith(docsBaseDir)
    ? normalizePath(path.relative(docsBaseDir, resolvedFile))
    : null;

  return ignorePatterns.some(pattern => {
    // Try matching against site-relative path
    if (minimatch(siteRelativePath, pattern, minimatchOptions)) {
      return true;
    }

    // Try matching against docs-relative path if available
    if (docsRelativePath && minimatch(docsRelativePath, pattern, minimatchOptions)) {
      return true;
    }

    return false;
  });
}

/**
 * Recursively reads all Markdown files in a directory
 * @param dir - Directory to scan
 * @param baseDir - Base directory (site root) for relative paths
 * @param ignorePatterns - Glob patterns for files to ignore
 * @param docsDir - Docs directory name (e.g., 'docs')
 * @param warnOnIgnoredFiles - Whether to warn about ignored files
 * @param visitedPaths - Set of already visited real paths to detect symlink loops (internal use)
 * @returns Array of file paths
 */
export async function readMarkdownFiles(
  dir: string,
  baseDir: string,
  ignorePatterns: string[] = [],
  docsDir: string = 'docs',
  warnOnIgnoredFiles: boolean = false,
  visitedPaths: Set<string> = new Set()
): Promise<string[]> {
  // Get real path to detect symlink loops
  let realPath: string;
  try {
    realPath = await fs.realpath(dir);
  } catch (error: unknown) {
    logger.warn(`Failed to resolve real path for ${dir}: ${getErrorMessage(error)}`);
    return [];
  }

  // Check if we've already visited this path (symlink loop detection)
  if (visitedPaths.has(realPath)) {
    logger.warn(`Skipping already visited path (possible symlink loop): ${dir}`);
    return [];
  }

  // Add to visited paths
  visitedPaths.add(realPath);

  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (shouldIgnoreFile(fullPath, baseDir, ignorePatterns, docsDir)) {
      continue;
    }

    // Handle both regular directories and symlinked directories
    let isDir = entry.isDirectory();
    if (!isDir && entry.isSymbolicLink()) {
      // Check if symlink points to a directory
      try {
        const stats = await fs.stat(fullPath);
        isDir = stats.isDirectory();
      } catch (error: unknown) {
        // Broken symlink, warn and skip it
        logger.warn(`Skipping broken symlink: ${fullPath}`);
        continue;
      }
    }

    if (isDir) {
      const subDirFiles = await readMarkdownFiles(fullPath, baseDir, ignorePatterns, docsDir, warnOnIgnoredFiles, visitedPaths);
      files.push(...subDirFiles);
    } else if (!entry.name.includes('.')) {
      // File without extension
      if (warnOnIgnoredFiles) {
        logger.warn(`Ignoring file without extension: ${fullPath}`);
      }
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      // Skip partial files (those starting with underscore)
      if (!entry.name.startsWith('_')) {
        files.push(fullPath);
      }
    } else {
      // Other extension
      if (warnOnIgnoredFiles) {
        logger.warn(`Ignoring file with unsupported extension: ${fullPath}`);
      }
    }
  }

  return files;
}

/**
 * Apply path transformations according to configuration
 * @param urlPath - Original URL path
 * @param pathTransformation - Path transformation configuration
 * @returns Transformed URL path
 */
export function applyPathTransformations(
  urlPath: string,
  pathTransformation?: PluginOptions['pathTransformation']
): string {
  if (!isDefined(pathTransformation)) {
    return urlPath;
  }

  let transformedPath = urlPath;

  // Remove ignored path segments
  if (isNonEmptyArray(pathTransformation.ignorePaths)) {
    for (const ignorePath of pathTransformation.ignorePaths) {
      // Create a regex that matches the ignore path at the beginning, middle, or end of the path
      // We use word boundaries to ensure we match complete path segments
      // Escape special regex characters in ignorePath to prevent regex injection
      const escapedIgnorePath = ignorePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const ignoreRegex = new RegExp(`(^|/)(${escapedIgnorePath})(/|$)`, 'g');
      transformedPath = transformedPath.replace(ignoreRegex, '$1$3');
    }
    
    // Clean up any double slashes that might have been created
    transformedPath = transformedPath.replace(/\/+/g, '/');

    // Remove leading and trailing slashes (removing a terminal segment can
    // leave a trailing slash, e.g. ignorePaths:['intro'] on 'api/intro').
    transformedPath = transformedPath.replace(/^\/|\/$/g, '');
  }
  
  // Add path segments if they're not already present
  if (isNonEmptyArray(pathTransformation.addPaths)) {
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

/**
 * Sanitize a string to create a safe filename
 * @param input - Input string (typically a title)
 * @param fallback - Fallback string if input becomes empty after sanitization
 * @returns Sanitized filename (without extension)
 * @throws ValidationError if input or fallback are not strings
 */
export function sanitizeForFilename(
  input: string,
  fallback: string = 'untitled',
  options: {
    preserveUnicode?: boolean;
    preserveCase?: boolean;
  } = {}
): string {
  // Validate input parameters
  validateString(input, 'input');
  validateString(fallback, 'fallback', { minLength: 1 });

  if (!isNonEmptyString(input)) return fallback;

  const { preserveUnicode = true, preserveCase = false } = options;

  let sanitized = preserveCase ? input : input.toLowerCase();

  if (preserveUnicode) {
    // Only remove filesystem-unsafe characters: / \ : * ? " < > |
    // Keep underscores, dots (except at start), hyphens, and unicode
    // Also replace spaces with dashes for better filesystem compatibility
    sanitized = sanitized.replace(/[/\\:*?"<>|\s]+/g, '-');
  } else {
    // Allow alphanumeric, underscores, hyphens, dots. Include A-Z so that
    // preserveCase keeps uppercase letters (when preserveCase is false the
    // input is already lowercased, so allowing A-Z is a no-op there).
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]+/g, '-');
  }

  // Remove leading dots (hidden files on Unix)
  sanitized = sanitized.replace(/^\.+/, '');

  // Clean up multiple dashes and trim
  sanitized = sanitized
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || fallback;
}

/**
 * Ensure a unique identifier from a set of used identifiers
 * @param baseIdentifier - Base identifier to make unique
 * @param usedIdentifiers - Set of already used identifiers
 * @param suffix - Suffix pattern (default: number in parentheses)
 * @returns Unique identifier
 * @throws ValidationError if baseIdentifier is not a string or usedIdentifiers is not a Set
 */
export function ensureUniqueIdentifier(
  baseIdentifier: string,
  usedIdentifiers: Set<string>,
  suffix: (counter: number, base: string) => string = (counter) => `(${counter})`
): string {
  // Validate input parameters
  validateString(baseIdentifier, 'baseIdentifier', { minLength: 1 });
  validateRequired(usedIdentifiers, 'usedIdentifiers');

  if (!(usedIdentifiers instanceof Set)) {
    throw new ValidationError(`Parameter 'usedIdentifiers' must be a Set`);
  }

  const MAX_ITERATIONS = 10000;
  let uniqueIdentifier = baseIdentifier;
  let counter = 1;
  let iterations = 0;

  while (usedIdentifiers.has(uniqueIdentifier.toLowerCase())) {
    counter++;
    uniqueIdentifier = `${baseIdentifier}${suffix(counter, baseIdentifier)}`;

    iterations++;
    if (iterations >= MAX_ITERATIONS) {
      // Fallback to timestamp-based unique identifier
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      uniqueIdentifier = `${baseIdentifier}-${timestamp}-${random}`;
      logger.warn(`Maximum iterations reached for unique identifier. Using fallback: ${uniqueIdentifier}`);
      break;
    }
  }

  usedIdentifiers.add(uniqueIdentifier.toLowerCase());
  return uniqueIdentifier;
}

/**
 * Join a route path onto `siteUrl`, preserving the baseUrl pathname that
 * `siteUrl` already carries (e.g. `https://host/docs`). The route is prepended
 * with the baseUrl only when it doesn't already start with it, so the baseUrl is
 * neither dropped nor duplicated regardless of whether Docusaurus routes include
 * it. `routePath` is used as-is (already URL-encoded by the caller when needed).
 *
 * @param siteUrl - Site URL including baseUrl pathname
 * @param routePath - Route path, with or without a leading slash / baseUrl prefix
 * @returns Absolute URL string
 */
export function joinSiteUrl(siteUrl: string, routePath: string): string {
  const path = routePath.startsWith('/') ? routePath : `/${routePath}`;
  try {
    const base = new URL(siteUrl);
    const basePath = base.pathname.replace(/\/+$/, ''); // '' for root, '/docs' otherwise
    const full = basePath && path !== basePath && !path.startsWith(`${basePath}/`)
      ? `${basePath}${path}`
      : path;
    return `${base.origin}${full}`;
  } catch {
    // Malformed siteUrl — string-concatenate; siteUrl retains its baseUrl.
    return `${siteUrl.replace(/\/+$/, '')}${path}`;
  }
}

