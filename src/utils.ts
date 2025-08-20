/**
 * Utility functions for the docusaurus-plugin-llms plugin
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { minimatch } from 'minimatch';
import matter from 'gray-matter';
import { PluginOptions } from './types';

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
 * @returns Content of the file
 */
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf8');
}

/**
 * Check if a file should be ignored based on glob patterns
 * @param filePath - Path to the file
 * @param baseDir - Base directory for relative paths
 * @param ignorePatterns - Glob patterns for files to ignore
 * @returns Whether the file should be ignored
 */
export function shouldIgnoreFile(filePath: string, baseDir: string, ignorePatterns: string[]): boolean {
  if (ignorePatterns.length === 0) {
    return false;
  }
  
  const relativePath = path.relative(baseDir, filePath);
  
  return ignorePatterns.some(pattern => 
    minimatch(relativePath, pattern, { matchBase: true })
  );
}

/**
 * Recursively reads all Markdown files in a directory
 * @param dir - Directory to scan
 * @param baseDir - Base directory for relative paths
 * @param ignorePatterns - Glob patterns for files to ignore
 * @returns Array of file paths
 */
export async function readMarkdownFiles(dir: string, baseDir: string, ignorePatterns: string[] = []): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (shouldIgnoreFile(fullPath, baseDir, ignorePatterns)) {
      continue;
    }
    
    if (entry.isDirectory()) {
      const subDirFiles = await readMarkdownFiles(fullPath, baseDir, ignorePatterns);
      files.push(...subDirFiles);
    } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
      // Skip partial files (those starting with underscore)
      if (!entry.name.startsWith('_')) {
        files.push(fullPath);
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
  // First try frontmatter
  if (data.title) {
    return data.title;
  }
  
  // Then try first heading
  const headingMatch = content.match(/^#\s+(.*)/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }
  
  // Finally use filename
  return path.basename(filePath, path.extname(filePath))
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Resolve and inline partial imports in markdown content
 * @param content - The markdown content with import statements
 * @param filePath - The path of the file containing the imports
 * @returns Content with partials resolved
 */
export async function resolvePartialImports(content: string, filePath: string): Promise<string> {
  let resolved = content;
  
  // Match import statements for partials and JSX usage
  // Pattern 1: import PartialName from './_partial.mdx'
  // Pattern 2: import { PartialName } from './_partial.mdx'
  const importRegex = /^\s*import\s+(?:(\w+)|{\s*(\w+)\s*})\s+from\s+['"]([^'"]+_[^'"]+\.mdx?)['"];?\s*$/gm;
  const imports = new Map<string, string>();
  
  // First pass: collect all imports
  let match;
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
      
      // Read the partial file
      const partialContent = await readFile(partialPath);
      const { content: partialMarkdown } = matter(partialContent);
      
      // Remove the import statement
      resolved = resolved.replace(
        new RegExp(`^\\s*import\\s+(?:${componentName}|{\\s*${componentName}\\s*})\\s+from\\s+['"]${importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"];?\\s*$`, 'gm'),
        ''
      );
      
      // Replace JSX usage with the partial content
      // Handle both self-closing tags and tags with content
      // <PartialName /> or <PartialName></PartialName> or <PartialName>...</PartialName>
      const jsxRegex = new RegExp(`<${componentName}\\s*(?:[^>]*?)(?:/>|>[^<]*</${componentName}>)`, 'g');
      resolved = resolved.replace(jsxRegex, partialMarkdown.trim());
      
    } catch (error) {
      console.warn(`Failed to resolve partial import "${importPath}" in ${filePath}: ${error}`);
      // Leave the import and usage as-is if we can't resolve it
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
  if (!pathTransformation) {
    return urlPath;
  }

  let transformedPath = urlPath;
  
  // Remove ignored path segments
  if (pathTransformation.ignorePaths?.length) {
    for (const ignorePath of pathTransformation.ignorePaths) {
      // Create a regex that matches the ignore path at the beginning, middle, or end of the path
      // We use word boundaries to ensure we match complete path segments
      const ignoreRegex = new RegExp(`(^|/)(${ignorePath})(/|$)`, 'g');
      transformedPath = transformedPath.replace(ignoreRegex, '$1$3');
    }
    
    // Clean up any double slashes that might have been created
    transformedPath = transformedPath.replace(/\/+/g, '/');
    
    // Remove leading slash if present
    transformedPath = transformedPath.replace(/^\//, '');
  }
  
  // Add path segments if they're not already present
  if (pathTransformation.addPaths?.length) {
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