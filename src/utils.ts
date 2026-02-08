/**
 * Utility functions for the docusaurus-plugin-llms plugin
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { minimatch } from 'minimatch';
import matter from 'gray-matter';
import * as YAML from 'yaml';
import { PluginOptions } from './types';

/**
 * Null/Undefined Handling Guidelines:
 *
 * 1. For required parameters: Throw early if null/undefined
 * 2. For optional parameters: Use optional chaining `value?.property`
 * 3. For explicit null checks: Use `!== null` and `!== undefined` or the isDefined type guard
 * 4. For string validation: Use isNonEmptyString() type guard
 * 5. For truthy checks on booleans: Use explicit comparison or Boolean(value)
 *
 * Avoid: `if (value)` when value could be 0, '', or false legitimately
 * Use: Type guards for consistent, type-safe checks
 */

/**
 * Type guard to check if a value is defined (not null or undefined)
 * @param value - Value to check
 * @returns True if value is not null or undefined
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard to check if a value is a non-empty string
 * @param value - Value to check
 * @returns True if value is a string with at least one non-whitespace character
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Type guard to check if a value is a non-empty array
 * @param value - Value to check
 * @returns True if value is an array with at least one element
 */
export function isNonEmptyArray<T>(value: unknown): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Safely extract an error message from an unknown error value
 * @param error - The error value (can be Error, string, or any other type)
 * @returns A string representation of the error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    const stringified = JSON.stringify(error);
    // JSON.stringify returns undefined for undefined values, handle that case
    return stringified !== undefined ? stringified : 'Unknown error';
  } catch {
    return 'Unknown error';
  }
}

/**
 * Extract stack trace from unknown error types
 * @param error - The error value (can be Error or any other type)
 * @returns Stack trace if available, undefined otherwise
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates that a value is not null or undefined
 * @param value - The value to validate
 * @param paramName - The parameter name for error messages
 * @returns The validated value
 * @throws ValidationError if the value is null or undefined
 */
export function validateRequired<T>(
  value: T | null | undefined,
  paramName: string
): T {
  if (value === null || value === undefined) {
    throw new ValidationError(`Required parameter '${paramName}' is null or undefined`);
  }
  return value;
}

/**
 * Validates that a value is a string and optionally checks its properties
 * @param value - The value to validate
 * @param paramName - The parameter name for error messages
 * @param options - Validation options for min/max length and pattern
 * @returns The validated string
 * @throws ValidationError if validation fails
 */
export function validateString(
  value: unknown,
  paramName: string,
  options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {}
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`Parameter '${paramName}' must be a string, got ${typeof value}`);
  }

  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new ValidationError(`Parameter '${paramName}' must be at least ${options.minLength} characters`);
  }

  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new ValidationError(`Parameter '${paramName}' exceeds maximum length of ${options.maxLength}`);
  }

  if (options.pattern && !options.pattern.test(value)) {
    throw new ValidationError(`Parameter '${paramName}' does not match required pattern`);
  }

  return value;
}

/**
 * Validates that a value is an array and optionally validates elements
 * @param value - The value to validate
 * @param paramName - The parameter name for error messages
 * @param elementValidator - Optional function to validate each element
 * @returns The validated array
 * @throws ValidationError if validation fails
 */
export function validateArray<T>(
  value: unknown,
  paramName: string,
  elementValidator?: (item: unknown) => boolean
): T[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`Parameter '${paramName}' must be an array`);
  }

  if (elementValidator) {
    value.forEach((item, index) => {
      if (!elementValidator(item)) {
        throw new ValidationError(`Element at index ${index} in '${paramName}' failed validation`);
      }
    });
  }

  return value as T[];
}

/**
 * Logging level enumeration
 */
export enum LogLevel {
  QUIET = 0,
  NORMAL = 1,
  VERBOSE = 2
}

let currentLogLevel = LogLevel.NORMAL;

/**
 * Set the logging level for the plugin
 * @param level - The logging level to use
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Logger utility for consistent logging across the plugin
 */
export const logger = {
  error: (message: string) => {
    console.error(`[docusaurus-plugin-llms] ERROR: ${message}`);
  },
  warn: (message: string) => {
    if (currentLogLevel >= LogLevel.NORMAL) {
      console.warn(`[docusaurus-plugin-llms] ${message}`);
    }
  },
  info: (message: string) => {
    if (currentLogLevel >= LogLevel.NORMAL) {
      console.log(`[docusaurus-plugin-llms] ${message}`);
    }
  },
  verbose: (message: string) => {
    if (currentLogLevel >= LogLevel.VERBOSE) {
      console.log(`[docusaurus-plugin-llms] ${message}`);
    }
  }
};

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
 * Write content to a file
 * @param filePath - Path to write the file to
 * @param data - Content to write
 */
export async function writeFile(filePath: string, data: string): Promise<void> {
  return fs.writeFile(filePath, data, 'utf8');
}

/**
 * Read content from a file
 * @param filePath - Path of the file to read
 * @returns Content of the file with BOM removed if present
 */
export async function readFile(filePath: string): Promise<string> {
  let content = await fs.readFile(filePath, 'utf8');

  // Remove UTF-8 BOM if present
  // UTF-8 BOM is the character U+FEFF at the start of the file
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  return content;
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
 * Extract title from content or use the filename
 * @param data - Frontmatter data
 * @param content - Markdown content
 * @param filePath - Path to the file
 * @returns Extracted title
 */
export function extractTitle(data: any, content: string, filePath: string): string {
  // First try frontmatter (check for valid non-empty string)
  if (isNonEmptyString(data.title)) {
    return data.title;
  }

  // Then try first heading
  const headingMatch = content.match(/^#\s+(.*)/m);
  if (isNonEmptyString(headingMatch?.[1])) {
    return headingMatch[1].trim();
  }

  // Finally use filename
  return path.basename(filePath, path.extname(filePath))
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

/**
 * Escape special regex characters in a string
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve and inline partial imports in markdown content
 * @param content - The markdown content with import statements
 * @param filePath - The path of the file containing the imports
 * @param importChain - Set of file paths in the current import chain (for circular dependency detection)
 * @returns Content with partials resolved
 */
export async function resolvePartialImports(
  content: string,
  filePath: string,
  importChain: Set<string> = new Set()
): Promise<string> {
  let resolved = content;

  // Match import statements for partials and JSX usage
  // Pattern 1: import PartialName from './_partial.mdx'
  // Pattern 2: import { PartialName } from './_partial.mdx'
  // Create a fresh regex for each invocation to avoid lastIndex state leakage
  const createImportRegex = () => /^\s*import\s+(?:(\w+)|{\s*(\w+)\s*})\s+from\s+['"]([^'"]+_[^'"]+\.mdx?)['"];?\s*$/gm;
  const imports = new Map<string, string>();

  // First pass: collect all imports
  let match;
  const importRegex = createImportRegex();
  while ((match = importRegex.exec(content)) !== null) {
    const componentName = match[1] || match[2];
    const importPath = match[3];

    // Only process imports for partial files (containing underscore)
    if (importPath.includes('_')) {
      imports.set(componentName, importPath);
    }
  }

  // Resolve each partial import
  for (const [componentName, importPath] of imports) {
    try {
      // Resolve the partial file path relative to the current file
      const dir = path.dirname(filePath);
      const partialPath = path.resolve(dir, importPath);

      // Check for circular import
      if (importChain.has(partialPath)) {
        const chain = Array.from(importChain).join(' -> ');
        logger.error(`Circular import detected: ${chain} -> ${partialPath}`);

        // Escape special regex characters in component name and import path
        const escapedComponentName = escapeRegex(componentName);
        const escapedImportPath = escapeRegex(importPath);

        // Remove the import statement to prevent infinite recursion
        resolved = resolved.replace(
          new RegExp(`^\\s*import\\s+(?:${escapedComponentName}|{\\s*${escapedComponentName}\\s*})\\s+from\\s+['"]${escapedImportPath}['"];?\\s*$`, 'gm'),
          ''
        );

        // Remove JSX usage of this component
        const jsxRegex = new RegExp(`<${escapedComponentName}(?:\\s+[^>]*)?\\s*\\/?>(?:[\\s\\S]*?<\\/${escapedComponentName}>)?`, 'gm');
        resolved = resolved.replace(jsxRegex, '');

        continue;
      }

      // Add to chain before recursive call
      const newChain = new Set(importChain);
      newChain.add(partialPath);

      // Read the partial file
      let partialContent = await readFile(partialPath);
      const { content: partialMarkdown } = matter(partialContent);

      // Recursively resolve imports in the partial with the updated chain
      const resolvedPartial = await resolvePartialImports(partialMarkdown, partialPath, newChain);

      // Escape special regex characters in component name and import path
      const escapedComponentName = escapeRegex(componentName);
      const escapedImportPath = escapeRegex(importPath);

      // Remove the import statement
      resolved = resolved.replace(
        new RegExp(`^\\s*import\\s+(?:${escapedComponentName}|{\\s*${escapedComponentName}\\s*})\\s+from\\s+['"]${escapedImportPath}['"];?\\s*$`, 'gm'),
        ''
      );

      // Replace JSX usage with the partial content
      // Handle both self-closing tags and tags with content
      // <PartialName /> or <PartialName></PartialName> or <PartialName>...</PartialName>
      const jsxRegex = new RegExp(`<${escapedComponentName}\\s*(?:[^>]*?)(?:/>|>[^<]*</${escapedComponentName}>)`, 'g');
      resolved = resolved.replace(jsxRegex, resolvedPartial.trim());

    } catch (error: unknown) {
      logger.warn(`Failed to resolve partial import from ${importPath}: ${getErrorMessage(error)}`);

      // Remove both the import statement AND the JSX usage even if partial can't be resolved
      // This prevents leaving broken references in the output

      // Escape special regex characters in component name and import path
      const escapedComponentName = escapeRegex(componentName);
      const escapedImportPath = escapeRegex(importPath);

      // Remove the import statement
      resolved = resolved.replace(
        new RegExp(`^\\s*import\\s+(?:${escapedComponentName}|{\\s*${escapedComponentName}\\s*})\\s+from\\s+['"]${escapedImportPath}['"];?\\s*$`, 'gm'),
        ''
      );

      // Remove JSX usage of this component
      // Handle both self-closing tags (<Component />) and regular tags with content (<Component>...</Component>)
      const jsxRegex = new RegExp(`<${escapedComponentName}(?:\\s+[^>]*)?\\s*\\/?>(?:[\\s\\S]*?<\\/${escapedComponentName}>)?`, 'gm');
      resolved = resolved.replace(jsxRegex, '');
    }
  }

  return resolved;
}

/**
 * Clean markdown content for LLM consumption
 * @param content - Raw markdown content
 * @param excludeImports - Whether to exclude import statements
 * @param removeDuplicateHeadings - Whether to remove redundant content that duplicates heading text
 * @returns Cleaned content
 */
export function cleanMarkdownContent(content: string, excludeImports: boolean = false, removeDuplicateHeadings: boolean = false): string {
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
  
  // Remove HTML tags, but preserve XML content in code blocks
  // We need to be selective to avoid removing XML content from code blocks
  // This regex targets common HTML tags while being more conservative about XML
  cleaned = cleaned.replace(/<\/?(?:div|span|p|br|hr|img|a|strong|em|b|i|u|h[1-6]|ul|ol|li|table|tr|td|th|thead|tbody)\b[^>]*>/gi, '');
  
  // Remove redundant content that just repeats the heading (if requested)
  if (removeDuplicateHeadings) {
    // Split content into lines and process line by line
    const lines = cleaned.split('\n');
    const processedLines: string[] = [];
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
    
    // Remove leading slash if present
    transformedPath = transformedPath.replace(/^\//, '');
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
    // Allow alphanumeric, underscores, hyphens, dots
    sanitized = sanitized.replace(/[^a-z0-9_.-]+/g, '-');
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
 * Create standardized markdown content template
 * @param title - Document title
 * @param description - Document description
 * @param content - Document content
 * @param includeMetadata - Whether to include description metadata
 * @param frontMatter - Optional frontmatter to include at the top
 * @returns Formatted markdown content
 */
export function createMarkdownContent(
  title: string, 
  description: string = '', 
  content: string = '',
  includeMetadata: boolean = true,
  frontMatter?: Record<string, any>
): string {
  let result = '';
  
  // Add frontmatter if provided
  if (isDefined(frontMatter) && Object.keys(frontMatter).length > 0) {
    result += '---\n';
    result += YAML.stringify(frontMatter, {
      lineWidth: 0,
      defaultStringType: 'QUOTE_DOUBLE',
      defaultKeyType: 'PLAIN'
    });
    result += '---\n\n';
  }
  
  const descriptionLine = includeMetadata && description ? `\n\n> ${description}\n` : '\n';
  
  result += `# ${title}${descriptionLine}
${content}`.trim() + '\n';

  return result;
} 
