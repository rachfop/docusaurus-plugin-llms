/**
 * Utility functions for the docusaurus-plugin-llms plugin
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { minimatch } from 'minimatch';
import matter from 'gray-matter';
import * as YAML from 'yaml';
import { Dirent } from 'fs';
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
import { LogLevel, logger } from './logger';

// Re-export the leaf modules so existing `./utils` imports keep working.
export * from './guards';
export * from './logger';

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
 * Mask fenced code blocks (``` / ~~~) and inline code spans with opaque
 * placeholder tokens so that content transforms — HTML/JSX stripping, import
 * removal, image-URL rewriting, heading detection — never alter code samples.
 * Returns the masked string plus a `restore()` that swaps the code back in.
 */
export function maskCodeSegments(content: string): { masked: string; restore: (s: string) => string } {
  const segments: string[] = [];
  const store = (code: string): string => {
    const token = `￼CODE${segments.length}￼`;
    segments.push(code);
    return token;
  };

  // Fenced code blocks first: opening fence (>=3 backticks or tildes) through a
  // closing fence of the same character (>=3, count need not match, per
  // CommonMark). The leading newline (if any) stays outside the token so line
  // structure is unchanged.
  let masked = content.replace(
    /(^|\n)([ \t]*(?:`{3,}[^\n]*\n[\s\S]*?\n[ \t]*`{3,}|~{3,}[^\n]*\n[\s\S]*?\n[ \t]*~{3,})[ \t]*)(?=\n|$)/g,
    (_match, lead, block) => `${lead}${store(block)}`
  );

  // Then inline code spans (`code`, ``co`de``) — a span never crosses a line.
  masked = masked.replace(/(`+)(?:(?!\1)[^\n])+?\1/g, (m) => store(m));

  const restore = (s: string): string =>
    s.replace(/￼CODE(\d+)￼/g, (_t, i) => segments[Number(i)] ?? '');

  return { masked, restore };
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

  // Then try first heading — but ignore `#` lines inside code blocks (e.g. a
  // shell/python comment), which are not document titles. Restore any inline
  // code in the matched heading so the title isn't left with placeholder tokens.
  const { masked, restore } = maskCodeSegments(content);
  const headingMatch = masked.match(/^#\s+(.*)/m);
  if (isNonEmptyString(headingMatch?.[1])) {
    return restore(headingMatch![1]).trim();
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
  // Mask code blocks / inline code so the strips below never touch code samples
  // (e.g. an HTML or `import` example shown inside a fenced block).
  const { masked, restore } = maskCodeSegments(content);
  let cleaned = masked;

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

  // Remove common HTML tags (code blocks are already masked out above).
  cleaned = cleaned.replace(/<\/?(?:div|span|p|br|hr|img|a|strong|em|b|i|u|h[1-6]|ul|ol|li|table|tr|td|th|thead|tbody)\b[^>]*>/gi, '');

  // Remove MDX/JSX component tags (PascalCase element names such as <Tabs>,
  // <TabItem>, <Admonition>), keeping their inner text content.
  cleaned = cleaned.replace(/<\/?[A-Z][A-Za-z0-9.]*\b[^>]*\/?>/g, '');

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

  // Restore the masked code blocks / inline code.
  cleaned = restore(cleaned);

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

/** Image extensions recognised by Docusaurus / browsers (regex alternation). */
const IMAGE_EXTENSIONS = 'png|jpe?g|gif|svg|webp|bmp|ico|avif|tiff?';

/**
 * Scan `{outDir}/assets/images/` and build a reverse-lookup map used to
 * rewrite relative image references to their hashed build-output URLs.
 *
 * Bundlers (webpack / Rspack) output images as `{original-name}-{hash}.{ext}`.
 * We strip the trailing `-{hex}` portion to recover the original basename and
 * use it as the lookup key.  When two images share the same basename but have
 * different content (different hashes) both entries are kept so a later
 * byte-comparison step can disambiguate them.
 *
 * @param outDir - Docusaurus build output directory (e.g., `<siteDir>/build`)
 * @returns Map from original-basename (e.g., `diagram.png`) to one or more
 *          site-root-relative hashed paths (e.g., `/assets/images/diagram-abc.png`)
 */
export async function buildImageAssetMap(outDir: string): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const imagesDir = path.join(outDir, 'assets', 'images');

  let entries: Dirent[];
  try {
    entries = await fs.readdir(imagesDir, { withFileTypes: true });
  } catch {
    return map; // Directory doesn't exist — no images
  }

  // Match `{original-name}-{16..64 hex chars}.{ext}` produced by webpack/Rspack
  const hashSuffixRe = new RegExp(`^(.+)-([0-9a-f]{16,64})(\\.(?:${IMAGE_EXTENSIONS}))$`, 'i');

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const m = name.match(hashSuffixRe);
    // key = original filename without the hash suffix, e.g. "diagram.png"
    const key = m ? `${m[1]}${m[3]}` : name;

    const assetPath = `/assets/images/${name}`;
    const existing = map.get(key);
    if (existing) {
      existing.push(assetPath);
    } else {
      map.set(key, [assetPath]);
    }
  }

  return map;
}

/**
 * Rewrite relative image references in markdown content to absolute URLs
 * pointing to the hashed build output in `assets/images/`.
 *
 * Handles:
 *   - Markdown images:  `![alt](./img/foo.png)`
 *   - HTML img tags:    `<img src="./img/foo.png" />`  (both quote styles)
 *
 * Resolution strategy:
 *   1. Extract the basename from the relative path (e.g., `foo.png`).
 *   2. Look it up in `imageAssetMap` (built by `buildImageAssetMap`).
 *   3. One candidate  → rewrite immediately.
 *   4. Multiple candidates → read source file bytes and compare against each
 *      candidate to find the exact match.  Falls back to keeping the original
 *      path if the source file cannot be read.
 *   5. Zero candidates → keep the original path as-is (static/ images, etc.).
 *
 * @param content        - Cleaned markdown content to process
 * @param sourceFilePath - Absolute path of the source `.md` file (used to
 *                         resolve relative image paths and for byte comparison)
 * @param imageAssetMap  - Lookup map built by `buildImageAssetMap`
 * @param siteUrl        - Site base URL used to build absolute image URLs
 * @param outDir         - Build output directory (needed for byte comparison)
 * @returns Content with rewritten image URLs
 */
export async function rewriteRelativeImageUrls(
  content: string,
  sourceFilePath: string,
  imageAssetMap: Map<string, string[]>,
  siteUrl: string,
  outDir: string
): Promise<string> {
  const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  const sourceDir = path.dirname(sourceFilePath);

  // Mask code so image syntax shown inside code blocks isn't rewritten.
  const { masked, restore } = maskCodeSegments(content);

  const imgExtRe = new RegExp(`\\.(?:${IMAGE_EXTENSIONS})$`, 'i');

  // Matches relative image references regardless of how many `../` levels deep.
  //   Group 1+2: Markdown  `![alt](./rel/path.ext)`     prefix + path
  //   Group 3+4: HTML      `src="./rel/path.ext"`       prefix + path
  //
  // The path group starts with `.` (captures `./`, `../`, `../../`, etc.).
  // Image-extension filtering is done separately with imgExtRe so we don't
  // accidentally miss legitimate multi-level paths.
  const imageRefRe = /(!\[[^\]]*\]\()(\.[^)"'\s]+)|(src=["'])(\.[^"'\s]+)/gi;

  // Collect unique relative paths that point to image files
  const uniquePaths = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = imageRefRe.exec(masked)) !== null) {
    const relPath = m[2] ?? m[4]; // markdown group or HTML group
    if (imgExtRe.test(relPath.split('?')[0].split('#')[0])) {
      uniquePaths.add(relPath);
    }
  }

  if (uniquePaths.size === 0) return content;

  // Resolve each unique path to an absolute URL (cached)
  const resolved = new Map<string, string>(); // relPath → absolute URL or original

  for (const relPath of uniquePaths) {
    const basename = path.basename(relPath.split('?')[0].split('#')[0]);
    const candidates = imageAssetMap.get(basename) ?? [];

    let assetPath: string | null = null;

    if (candidates.length === 1) {
      assetPath = candidates[0];
    } else if (candidates.length > 1) {
      // Multiple files with same basename — byte-compare to find the right one
      const absSource = path.resolve(sourceDir, relPath.split('?')[0].split('#')[0]);
      try {
        const srcBytes = await fs.readFile(absSource);
        for (const candidate of candidates) {
          try {
            const candidateBytes = await fs.readFile(path.join(outDir, candidate));
            if (srcBytes.equals(candidateBytes)) {
              assetPath = candidate;
              break;
            }
          } catch { /* candidate unreadable — skip */ }
        }
      } catch { /* source unreadable — keep original */ }
    }

    // Preserve any query string / fragment (e.g. "?raw=1", "#anchor") so we
    // don't change semantics for downstream tooling that relies on them.
    const suffixMatch = relPath.match(/[?#].*$/);
    const suffix = suffixMatch ? suffixMatch[0] : '';
    resolved.set(relPath, assetPath ? `${baseUrl}${assetPath}${suffix}` : relPath);
  }

  // Apply all substitutions in a single pass, then restore masked code.
  return restore(masked.replace(imageRefRe, (match, mdPrefix, mdPath, htmlPrefix, htmlPath) => {
    const relPath = mdPath ?? htmlPath;
    const target = resolved.get(relPath);
    if (!target || target === relPath) return match; // no change
    if (mdPrefix) return `${mdPrefix}${target}`;
    return `${htmlPrefix}${target}`;
  }));
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
