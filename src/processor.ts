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
  resolvePartialImports
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
  resolvedUrl?: string
): Promise<DocInfo | null> {
  const content = await readFile(filePath);
  const { data, content: markdownContent } = matter(content);
  
  // Skip draft files
  if (data.draft === true) {
    return null;
  }
  
  // Resolve partial imports before processing
  const resolvedContent = await resolvePartialImports(markdownContent, filePath);
  
  const relativePath = path.relative(baseDir, filePath);
  // Convert to URL path format (replace backslashes with forward slashes on Windows)
  const normalizedPath = relativePath.replace(/\\/g, '/');
  
  let fullUrl: string;
  
  if (resolvedUrl) {
    // Use the actual resolved URL from Docusaurus if provided
    fullUrl = new URL(resolvedUrl, siteUrl).toString();
  } else {
    // Fallback to the old path construction method
    // Convert .md extension to appropriate path
    const linkPathBase = normalizedPath.replace(/\.mdx?$/, '');
    
    // Handle index files specially
    let linkPath = linkPathBase.endsWith('index') 
      ? linkPathBase.replace(/\/index$/, '') 
      : linkPathBase;
    
    // linkPath might include the pathPrefix (e.g., "docs/api/core")
    // We need to remove the pathPrefix before applying transformations, then add it back later
    if (pathPrefix && linkPath.startsWith(`${pathPrefix}/`)) {
      linkPath = linkPath.substring(`${pathPrefix}/`.length);
    } else if (pathPrefix && linkPath === pathPrefix) {
      linkPath = '';
    }
    
    // Apply path transformations to the clean link path (without pathPrefix)
    const transformedLinkPath = applyPathTransformations(linkPath, pathTransformation);
    
    // Also apply path transformations to the pathPrefix if it's not empty
    // This allows removing 'docs' from the path when specified in ignorePaths
    let transformedPathPrefix = pathPrefix;
    if (pathPrefix && pathTransformation?.ignorePaths?.includes(pathPrefix)) {
      transformedPathPrefix = '';
    }
    
    // Generate full URL with transformed path and path prefix
    fullUrl = new URL(
      `${transformedPathPrefix ? `${transformedPathPrefix}/` : ''}${transformedLinkPath}`, 
      siteUrl
    ).toString();
  }
  
  // Extract title
  const title = extractTitle(data, resolvedContent, filePath);
  
  // Get description from frontmatter or first paragraph
  let description = '';
  
  // First priority: Use frontmatter description if available
  if (data.description) {
    description = data.description;
  } else {
    // Second priority: Find the first non-heading paragraph
    const paragraphs = resolvedContent.split('\n\n');
    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      // Skip empty paragraphs and headings
      if (trimmedPara && !trimmedPara.startsWith('#')) {
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
  if (description) {
    // Original approach had issues with hashtags inside content
    // Fix: Only remove # symbols at the beginning of lines or description
    // that are followed by a space (actual heading markers)
    description = description.replace(/^(#+)\s+/gm, '');
    
    // Special handling for description frontmatter with heading markers
    if (data.description && data.description.startsWith('#')) {
      // If the description in frontmatter starts with a heading marker,
      // we should preserve it in the extracted description
      description = description.replace(/^#+\s+/, '');
    }
    
    // Preserve inline hashtags (not heading markers)
    // We don't want to treat hashtags in the middle of content as headings
    
    // Validate that the description doesn't contain markdown headings
    if (description.match(/^#+\s+/m)) {
      console.warn(`Warning: Description for "${title}" may still contain heading markers`);
    }
    
    // Warn if the description contains HTML tags
    if (/<[^>]+>/g.test(description)) {
      console.warn(`Warning: Description for "${title}" contains HTML tags`);
    }
    
    // Warn if the description is very long
    if (description.length > 500) {
      console.warn(`Warning: Description for "${title}" is very long (${description.length} characters)`);
    }
  }
  
  // Clean and process content (now with partials already resolved)
  const cleanedContent = cleanMarkdownContent(resolvedContent, excludeImports, removeDuplicateHeadings);
  
  return {
    title,
    path: normalizedPath,
    url: fullUrl,
    content: cleanedContent,
    description: description || '',
    frontMatter: data,
  };
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
      const relativePath = path.relative(siteDir, file);
      return includePatterns.some(pattern => 
        minimatch(relativePath, pattern, { matchBase: true })
      );
    });
  }
  
  // Apply ignore patterns
  if (ignorePatterns.length > 0) {
    filteredFiles = filteredFiles.filter(file => {
      const relativePath = path.relative(siteDir, file);
      return !ignorePatterns.some(pattern => 
        minimatch(relativePath, pattern, { matchBase: true })
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
        const relativePath = path.relative(siteDir, file);
        return minimatch(relativePath, pattern, { matchBase: true }) && !matchedFiles.has(file);
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
  
  // Process each file to generate DocInfo
  const processedDocs: DocInfo[] = [];
  
  for (const filePath of filesToProcess) {
    try {
      // Determine if this is a blog or docs file
      const isBlogFile = filePath.includes(path.join(siteDir, 'blog'));
      // Use siteDir as baseDir to preserve full directory structure (docs/path/file.md instead of just path/file.md)
      const baseDir = siteDir;
      const pathPrefix = isBlogFile ? 'blog' : 'docs';
      
      // Try to find the resolved URL for this file from the route map
      let resolvedUrl: string | undefined;
      if (context.routeMap) {
        // Convert file path to a potential route path
        const relativePath = path.relative(baseDir, filePath)
          .replace(/\\/g, '/')
          .replace(/\.mdx?$/, '')
          .replace(/\/index$/, '');
        
        // Function to remove numbered prefixes from path segments
        const removeNumberedPrefixes = (path: string): string => {
          return path.split('/').map(segment => {
            // Remove numbered prefixes like "01-", "1-", "001-" from each segment
            return segment.replace(/^\d+-/, '');
          }).join('/');
        };
        
        // Check various possible route patterns
        const cleanPath = removeNumberedPrefixes(relativePath);
        const possiblePaths = [
          `/${pathPrefix}/${cleanPath}`,
          `/${cleanPath}`,
          `/${pathPrefix}/${relativePath}`, // Try with original path
          `/${relativePath}`, // Try without prefix
        ];
        
        // Also handle nested folder structures with numbered prefixes
        const segments = relativePath.split('/');
        if (segments.length > 1) {
          // Try removing numbered prefixes from different levels
          for (let i = 0; i < segments.length; i++) {
            const modifiedSegments = [...segments];
            modifiedSegments[i] = modifiedSegments[i].replace(/^\d+-/, '');
            const modifiedPath = modifiedSegments.join('/');
            possiblePaths.push(`/${pathPrefix}/${modifiedPath}`);
            possiblePaths.push(`/${modifiedPath}`);
          }
        }
        
        // Try to find a match in the route map
        for (const possiblePath of possiblePaths) {
          if (context.routeMap.has(possiblePath)) {
            resolvedUrl = context.routeMap.get(possiblePath);
            break;
          }
        }
        
        // If still not found, try to find the best match using the routesPaths array
        if (!resolvedUrl && context.routesPaths) {
          const normalizedCleanPath = cleanPath.toLowerCase();
          const matchingRoute = context.routesPaths.find(routePath => {
            const normalizedRoute = routePath.toLowerCase();
            return normalizedRoute.endsWith(`/${normalizedCleanPath}`) || 
                   normalizedRoute === `/${pathPrefix}/${normalizedCleanPath}` ||
                   normalizedRoute === `/${normalizedCleanPath}`;
          });
          if (matchingRoute) {
            resolvedUrl = matchingRoute;
          }
        }
        
        // Log when we successfully resolve a URL using Docusaurus routes
        if (resolvedUrl && resolvedUrl !== `/${pathPrefix}/${relativePath}`) {
          console.log(`Resolved URL for ${path.basename(filePath)}: ${resolvedUrl} (was: /${pathPrefix}/${relativePath})`);
        }
      }
      
      const docInfo = await processMarkdownFile(
        filePath, 
        baseDir, 
        siteUrl,
        pathPrefix,
        context.options.pathTransformation,
        context.options.excludeImports || false,
        context.options.removeDuplicateHeadings || false,
        resolvedUrl
      );
      if (docInfo !== null) {
        processedDocs.push(docInfo);
      }
    } catch (err: any) {
      console.warn(`Error processing ${filePath}: ${err.message}`);
    }
  }
  
  return processedDocs;
} 