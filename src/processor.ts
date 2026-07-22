/**
 * Document processing functions for the docusaurus-plugin-llms plugin
 */

import * as path from 'path';
import matter from 'gray-matter';
import { minimatch } from 'minimatch';
import { DocInfo, PluginContext } from './types';
import {
  readFile,
  extractTitle,
  cleanMarkdownContent,
  applyPathTransformations,
  resolvePartialImports,
  normalizePath,
  logger,
  getErrorMessage,
  isNonEmptyString,
  coerceFrontMatterString,
  stripPathNumberPrefixes,
  rewriteRelativeImageUrls,
  joinSiteUrl
} from './utils';

/**
 * Process a markdown file and extract its metadata and content
 * @param filePath - Path to the markdown file
 * @param baseDir - Base directory
 * @param siteUrl - Base URL of the site
 * @param pathPrefix - Path prefix for URLs (e.g., 'docs' or 'blog')
 * @param pathTransformation - Path transformation configuration
 * @returns Processed file data
 */
export async function processMarkdownFile(
  filePath: string,
  baseDir: string,
  siteUrl: string,
  pathPrefix: string = 'docs',
  pathTransformation?: {
    ignorePaths?: string[];
    addPaths?: string[];
  },
  excludeImports: boolean = false,
  removeDuplicateHeadings: boolean = false,
  resolvedUrl?: string,
  imageAssetMap?: Map<string, string[]>,
  outDir?: string,
  siteDir?: string
): Promise<DocInfo | null> {
  const content = await readFile(filePath);
  const { data, content: markdownContent } = matter(content);

  // Skip draft files (accept both boolean true and the string "true", which
  // some editors emit as quoted frontmatter).
  if (data.draft === true || data.draft === 'true') {
    return null;
  }

  // YAML parses an unquoted numeric slug/id/title as a number; Docusaurus
  // coerces these to strings for routing, so mirror that before the string
  // guards below (otherwise a numeric slug is dropped and its route is lost).
  data.title = coerceFrontMatterString(data.title);
  data.slug = coerceFrontMatterString(data.slug);
  data.id = coerceFrontMatterString(data.id);

  // Validate and clean empty frontmatter fields
  // Empty strings should be treated as undefined to allow fallback logic
  if (data.title !== undefined && !isNonEmptyString(data.title)) {
    logger.warn(`Empty title in frontmatter for ${filePath}. Using fallback.`);
    data.title = undefined;
  }

  if (data.description !== undefined && !isNonEmptyString(data.description)) {
    data.description = undefined;
  }

  if (data.slug !== undefined && !isNonEmptyString(data.slug)) {
    data.slug = undefined;
  }

  if (data.id !== undefined && !isNonEmptyString(data.id)) {
    data.id = undefined;
  }
  
  // Resolve partial imports before processing
  const resolvedContent = await resolvePartialImports(markdownContent, filePath, new Set(), siteDir);
  
  const relativePath = path.relative(baseDir, filePath);
  // Convert to URL path format (replace backslashes with forward slashes on Windows)
  const normalizedPath = normalizePath(relativePath);
  
  let fullUrl: string;

  if (isNonEmptyString(resolvedUrl)) {
    // Use the actual resolved route from Docusaurus, preserving siteUrl's baseUrl.
    fullUrl = joinSiteUrl(siteUrl, resolvedUrl);
  } else {
    // Fallback to the old path construction method
    // Convert .md extension to appropriate path
    const linkPathBase = normalizedPath.replace(/\.mdx?$/, '');
    
    // Handle index files specially
    let linkPath = linkPathBase.endsWith('index') 
      ? linkPathBase.replace(/\/index$/, '') 
      : linkPathBase;
    
    // pathPrefix may carry a trailing slash (e.g. docsDir: 'foo/'); normalize it
    // so prefix matching and URL assembly never produce a doubled slash (#43).
    const cleanPrefix = pathPrefix ? pathPrefix.replace(/\/+$/, '') : pathPrefix;

    // linkPath might include the pathPrefix (e.g., "docs/api/core")
    // We need to remove the pathPrefix before applying transformations, then add it back later
    if (cleanPrefix && linkPath.startsWith(`${cleanPrefix}/`)) {
      linkPath = linkPath.substring(`${cleanPrefix}/`.length);
    } else if (cleanPrefix && linkPath === cleanPrefix) {
      linkPath = '';
    }

    // Apply path transformations to the clean link path (without pathPrefix)
    const transformedLinkPath = applyPathTransformations(linkPath, pathTransformation);

    // Also apply path transformations to the pathPrefix if it's not empty
    // This allows removing 'docs' from the path when specified in ignorePaths
    let transformedPathPrefix = cleanPrefix;
    if (
      cleanPrefix &&
      pathTransformation?.ignorePaths?.some(p => p.replace(/\/+$/, '') === cleanPrefix)
    ) {
      transformedPathPrefix = '';
    }
    
    // Ensure path segments are URL-safe with sophisticated encoding detection
    const encodedLinkPath = transformedLinkPath.split('/').map(segment => {
      // Check if segment contains characters that need encoding
      // Unreserved characters (per RFC 3986): A-Z a-z 0-9 - . _ ~
      if (!/[^A-Za-z0-9\-._~]/.test(segment)) {
        // Segment only contains unreserved characters, no encoding needed
        return segment;
      }

      try {
        // Try to decode - if it changes, it was already encoded
        const decoded = decodeURIComponent(segment);
        if (decoded !== segment) {
          // Was already encoded, return as-is
          return segment;
        }
        // Not encoded, encode it
        return encodeURIComponent(segment);
      } catch {
        // Malformed encoding, re-encode
        return encodeURIComponent(segment);
      }
    }).join('/');

    // Construct URL by encoding path components, then combine with site URL
    // Segments are pre-encoded above (the URL constructor would decode some), so
    // joinSiteUrl just attaches the baseUrl-aware origin.
    const pathPart = transformedPathPrefix ? `${transformedPathPrefix}/${encodedLinkPath}` : encodedLinkPath;
    fullUrl = joinSiteUrl(siteUrl, pathPart);
  }

  // Extract title
  const title = extractTitle(data, resolvedContent, filePath);
  
  // Get description from frontmatter or first paragraph
  let description = '';
  
  // First priority: Use frontmatter description if available
  if (isNonEmptyString(data.description)) {
    description = data.description;
  } else {
    // Second priority: Find the first non-heading paragraph
    const paragraphs = resolvedContent.split('\n\n');
    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      // Skip empty paragraphs, headings, and import/export statements
      const isImportOrExport = /^(import\s|export\s)/.test(trimmedPara);
      if (trimmedPara && !trimmedPara.startsWith('#') && !isImportOrExport) {
        description = trimmedPara;
        break;
      }
    }
    
    // Third priority: If still no description, use the first heading's content
    if (!description) {
      const firstHeadingMatch = resolvedContent.match(/^#\s+(.*?)$/m);
      if (firstHeadingMatch && firstHeadingMatch[1]) {
        description = firstHeadingMatch[1].trim();
      }
    }
  }
  
  // Only remove heading markers at the beginning of descriptions or lines
  // This preserves # characters that are part of the content
  if (isNonEmptyString(description)) {
    // Original approach had issues with hashtags inside content
    // Fix: Only remove # symbols at the beginning of lines or description
    // that are followed by a space (actual heading markers)
    description = description.replace(/^(#+)\s+/gm, '');
    
    // Special handling for description frontmatter with heading markers
    if (isNonEmptyString(data.description) && data.description.startsWith('#')) {
      // If the description in frontmatter starts with a heading marker,
      // we should preserve it in the extracted description
      description = description.replace(/^#+\s+/, '');
    }
    
    // Preserve inline hashtags (not heading markers)
    // We don't want to treat hashtags in the middle of content as headings
    
    // Validate that the description doesn't contain markdown headings
    if (description.match(/^#+\s+/m)) {
      logger.warn(`Warning: Description for "${title}" may still contain heading markers`);
    }
    
    // Warn if the description contains HTML tags
    if (/<[^>]+>/g.test(description)) {
      logger.warn(`Warning: Description for "${title}" contains HTML tags`);
    }
    
    // Warn if the description is very long
    if (description.length > 500) {
      logger.warn(`Warning: Description for "${title}" is very long (${description.length} characters)`);
    }
  }
  
  // Clean and process content (now with partials already resolved)
  const cleanedContent = cleanMarkdownContent(resolvedContent, excludeImports, removeDuplicateHeadings);
  
  // Rewrite relative image URLs to absolute build-output URLs when requested
  const finalContent = (imageAssetMap && outDir)
    ? await rewriteRelativeImageUrls(cleanedContent, filePath, imageAssetMap, siteUrl, outDir)
    : cleanedContent;
  
  return {
    title,
    path: normalizedPath,
    url: fullUrl,
    content: finalContent,
    description: description || '',
    frontMatter: data,
  };
}

/**
 * Restrict a route list to the subtree owned by the current version.
 *
 * - With no prefix info (single-version default), returns routes unchanged.
 * - A non-empty `routePrefix` (e.g. '/stable') keeps only routes under it.
 * - The root version (empty prefix) drops routes owned by sibling versions,
 *   so its links don't resolve into a versioned subtree.
 */
function scopeRoutesToVersion(
  routesPaths: string[],
  routePrefix?: string,
  siblingPrefixes?: string[]
): string[] {
  const prefix = routePrefix ? routePrefix.replace(/\/+$/, '') : '';
  if (prefix) {
    return routesPaths.filter(
      route => route === prefix || route.startsWith(`${prefix}/`)
    );
  }

  const siblings = (siblingPrefixes ?? [])
    .map(sibling => sibling.replace(/\/+$/, ''))
    .filter(Boolean);
  if (siblings.length === 0) return routesPaths;

  return routesPaths.filter(
    route =>
      !siblings.some(
        sibling => route === sibling || route.startsWith(`${sibling}/`)
      )
  );
}

/**
 * Find the best matching route for a given path tail using suffix matching.
 * This avoids needing to know about version prefixes, baseUrl, or other
 * routing details — any route ending with the tail is a match.
 * When multiple routes match, the shortest is preferred (typically the
 * stable/non-versioned route over a versioned one like /nightly/...).
 */
function findMatchingRoute(
  routesPaths: string[],
  tail: string
): string | undefined {
  const normalized = tail.toLowerCase().replace(/\/+$/, '');
  if (!normalized) return undefined;

  const matches = routesPaths.filter(route => {
    const r = route.toLowerCase().replace(/\/+$/, '');
    return r === `/${normalized}` || r.endsWith(`/${normalized}`);
  });

  if (matches.length <= 1) return matches[0];
  return matches.sort((a, b) => a.length - b.length)[0];
}

/**
 * Collapse a trailing segment that matches its parent directory name.
 * Docusaurus treats such files as directory indices
 * (e.g. "generics/generics" → "generics", "API/API" → "API").
 */
function collapseMatchingTrailingSegment(urlPath: string): string {
  const segments = urlPath.split('/');
  if (segments.length >= 2) {
    const last = segments[segments.length - 1];
    const parent = segments[segments.length - 2];
    if (last.toLowerCase() === parent.toLowerCase()) {
      return segments.slice(0, -1).join('/');
    }
  }
  return urlPath;
}

/**
 * Resolve the URL for a document by matching its file path against
 * Docusaurus's resolved routes using suffix matching.
 *
 * An explicit `slug`/`id` in frontmatter is authoritative and is consulted
 * first (e.g. python_to_mojo.mdx with id: python-to-mojo, or `slug: "/"` for a
 * section root page). Only when no such override resolves does it fall back to
 * a filename-based heuristic: strip the docsDir prefix and file extension to
 * get a "tail" (e.g. "manual/get-started"), then find any route ending with
 * that tail. The heuristic naturally handles version prefixes (/nightly/...),
 * custom baseUrl, and routeBasePath, but is a suffix-match guess — hence
 * frontmatter takes precedence to avoid coincidental cross-file collisions.
 */
async function resolveDocumentUrl(
  filePath: string,
  baseDir: string,
  context: PluginContext
): Promise<string | undefined> {
  if (!context.routesPaths?.length) return undefined;

  const { docsDir } = context;

  // In multi-version mode, restrict matching to routes owned by this version so
  // links resolve within the correct subtree (e.g. a 'stable' doc links to
  // /stable/... and the root version's links avoid versioned subtrees).
  const scopedRoutes = scopeRoutesToVersion(
    context.routesPaths,
    context.routePrefix,
    context.siblingPrefixes
  );
  if (!scopedRoutes.length) return undefined;

  const relative = normalizePath(path.relative(baseDir, filePath))
    .replace(/\.mdx?$/, '')
    .replace(/\/index$/, '');

  // Strip the docsDir prefix — docsDir is the filesystem root for the docs
  // plugin, which Docusaurus removes when computing routes
  let tail = relative;
  if (docsDir && tail.startsWith(`${docsDir}/`)) {
    tail = tail.substring(`${docsDir}/`.length);
  }

  // An explicit `slug`/`id` in frontmatter unambiguously declares the document's
  // real route, so it must take priority over the filename-tail heuristic below.
  // The heuristic is a suffix-match guess against *every* route and can otherwise
  // coincidentally steal an unrelated document's route (most damagingly for
  // `slug: "/"` root pages, whose bare filename tail can end up matching some
  // other file's nested route). Checking frontmatter first prevents that.
  try {
    const content = await readFile(filePath);
    const { data } = matter(content);

    for (const override of [coerceFrontMatterString(data.slug), coerceFrontMatterString(data.id)]) {
      if (!isNonEmptyString(override)) continue;
      const rawSlug = override.trim();

      // Handle root slug (slug: "/") — means the page is at the root of its section.
      // A plain slug strip would produce "" and skip; instead find the section this
      // file belongs to and use its routeBasePath to locate the correct route.
      if (/^\/+$/.test(rawSlug)) {
        // Determine which section owns this file to get the correct base route.
        let sectionBase = '/';
        if (context.docsSections?.length > 0) {
          const matched = context.docsSections.find(s => {
            const abs = path.resolve(baseDir, s.path);
            return filePath.startsWith(abs + path.sep) || filePath.startsWith(abs + '/');
          });
          if (matched && matched.routeBasePath !== '/') {
            sectionBase = `/${matched.routeBasePath}`;
          }
        }
        // Look for an exact or trailing-slash-equivalent route in routesPaths.
        const rootMatch = context.routesPaths.find(r => {
          const clean = r.replace(/\/+$/, '') || '/';
          return clean === sectionBase;
        });
        return rootMatch ?? sectionBase;
      }

      const slug = rawSlug.replace(/^\/+|\/+$/g, '');
      if (!isNonEmptyString(slug)) continue;
      const parentDir = path.dirname(tail);
      const overriddenTail = parentDir === '.' ? slug : `${parentDir}/${slug}`;
      const match = findMatchingRoute(scopedRoutes, overriddenTail);
      if (match) return match;
    }
  } catch {
    // Frontmatter read failed or absent; fall through to filename-based matching.
  }

  // Fall back to the filename-derived tail heuristic: build candidate tails
  // (original, directory-collapsed, numbered-prefix-stripped) and suffix-match.
  const tails = new Set<string>([tail]);

  const collapsed = collapseMatchingTrailingSegment(tail);
  if (collapsed !== tail) tails.add(collapsed);

  const stripped = stripPathNumberPrefixes(tail);
  if (stripped !== tail) tails.add(stripped);

  for (const t of tails) {
    const match = findMatchingRoute(scopedRoutes, t);
    if (match) return match;
  }

  return undefined;
}

/**
 * Process files based on include patterns, ignore patterns, and ordering
 * @param context - Plugin context
 * @param allFiles - All available files
 * @param includePatterns - Patterns for files to include
 * @param ignorePatterns - Patterns for files to ignore
 * @param orderPatterns - Patterns for ordering files
 * @param includeUnmatched - Whether to include unmatched files
 * @returns Processed files
 */
/**
 * Helper function to check if a file matches a pattern
 * Tries matching against multiple path variants for better usability
 */
function matchesPattern(file: string, pattern: string, siteDir: string, docsDir: string): boolean {
  const minimatchOptions = { matchBase: true };

  // Get site-relative path (e.g., "docs/quickstart/file.md")
  const siteRelativePath = normalizePath(path.relative(siteDir, file));

  // Get docs-relative path (e.g., "quickstart/file.md")
  // Normalize both paths to handle different path separators and resolve any .. or .
  const docsBaseDir = path.resolve(path.join(siteDir, docsDir));
  const resolvedFile = path.resolve(file);
  const docsRelativePath = resolvedFile.startsWith(docsBaseDir)
    ? normalizePath(path.relative(docsBaseDir, resolvedFile))
    : null;

  // Try matching against site-relative path
  if (minimatch(siteRelativePath, pattern, minimatchOptions)) {
    return true;
  }

  // Try matching against docs-relative path if available
  if (docsRelativePath && minimatch(docsRelativePath, pattern, minimatchOptions)) {
    return true;
  }

  return false;
}

export async function processFilesWithPatterns(
  context: PluginContext,
  allFiles: string[],
  includePatterns: string[] = [],
  ignorePatterns: string[] = [],
  orderPatterns: string[] = [],
  includeUnmatched: boolean = false
): Promise<DocInfo[]> {
  const { siteDir, siteUrl, docsDir } = context;
  
  // Filter files based on include patterns
  let filteredFiles = allFiles;
  
  if (includePatterns.length > 0) {
    filteredFiles = allFiles.filter(file => {
      return includePatterns.some(pattern =>
        matchesPattern(file, pattern, siteDir, docsDir)
      );
    });
  }
  
  // Apply ignore patterns
  if (ignorePatterns.length > 0) {
    filteredFiles = filteredFiles.filter(file => {
      return !ignorePatterns.some(pattern =>
        matchesPattern(file, pattern, siteDir, docsDir)
      );
    });
  }
  
  // Order files according to orderPatterns
  let filesToProcess: string[] = [];
  
  if (orderPatterns.length > 0) {
    const matchedFiles = new Set<string>();
    
    // Process files according to orderPatterns
    for (const pattern of orderPatterns) {
      const matchingFiles = filteredFiles.filter(file => {
        return matchesPattern(file, pattern, siteDir, docsDir) && !matchedFiles.has(file);
      });
      
      for (const file of matchingFiles) {
        filesToProcess.push(file);
        matchedFiles.add(file);
      }
    }
    
    // Add remaining files if includeUnmatched is true
    if (includeUnmatched) {
      const remainingFiles = filteredFiles.filter(file => !matchedFiles.has(file));
      filesToProcess.push(...remainingFiles);
    }
  } else {
    filesToProcess = filteredFiles;
  }
  
  // Process files in parallel using Promise.allSettled
  const results = await Promise.allSettled(
    filesToProcess.map(async (filePath) => {
      try {
        const baseDir = siteDir;
        const isBlogFile = filePath.includes(path.join(siteDir, 'blog'));

        // Determine which section this file belongs to
        let pathPrefix: string;
        let sectionLabel: string | undefined;

        if (isBlogFile) {
          pathPrefix = 'blog';
        } else if (context.docsSections && context.docsSections.length > 0) {
          const matchedSection = context.docsSections.find(s => {
            const sectionDir = path.join(siteDir, s.path);
            return filePath.startsWith(sectionDir + path.sep) || filePath.startsWith(sectionDir + '/');
          });

          if (matchedSection) {
            pathPrefix = matchedSection.routeBasePath;
            if (context.docsSections.length > 1) {
              sectionLabel = matchedSection.label || matchedSection.path;
            }
          } else {
            pathPrefix = docsDir;
          }
        } else {
          pathPrefix = docsDir;
        }

        const resolvedUrl = await resolveDocumentUrl(filePath, baseDir, context);

        if (resolvedUrl) {
          logger.verbose(`Resolved URL for ${path.basename(filePath)}: ${resolvedUrl}`);
        }

        const docInfo = await processMarkdownFile(
          filePath,
          baseDir,
          siteUrl,
          pathPrefix,
          context.options.pathTransformation,
          context.options.excludeImports || false,
          context.options.removeDuplicateHeadings || false,
          resolvedUrl,
          context.imageAssetMap,
          context.options.rewriteImageUrls ? context.outDir : undefined,
          siteDir
        );

        if (docInfo && sectionLabel) {
          docInfo.section = sectionLabel;
        }

        return docInfo;
      } catch (err: unknown) {
        logger.warn(`Error processing ${filePath}: ${getErrorMessage(err)}`);
        return null;
      }
    })
  );

  // Filter successful results and non-null DocInfo objects
  const processedDocs = results
    .filter((r): r is PromiseFulfilledResult<DocInfo | null> => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value as DocInfo);

  return processedDocs;
} 
