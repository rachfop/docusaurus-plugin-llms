/**
 * Markdown content processing: code-fence masking, title/description-safe
 * extraction, partial-import resolution, cleaning, and template assembly.
 */

import * as path from 'path';
import matter from 'gray-matter';
import * as YAML from 'yaml';
import { isDefined, isNonEmptyString, getErrorMessage } from './guards';
import { logger } from './logger';
import { readFile } from './files';

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
 * Regex source matching a tag's attribute run. `[^>]*` is not enough here:
 * `>` legally appears inside JSX expression attributes (`onClick={() => ...}`)
 * and quoted values (`title="a > b"`), so a naive scan cuts the tag short and
 * leaks the remainder into the output as prose. Values may be double-quoted,
 * single-quoted, a JSX brace expression, or bare.
 * Brace expressions are matched to one nesting level only; a deeper expression
 * makes the whole tag fail to match and stay intact in the output, which is
 * the safe failure direction (visible leftover rather than silent corruption).
 */
const TAG_ATTRS = /(?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\}|[^\s>]+))?)*\s*/.source;

/**
 * Resolve and inline partial imports in markdown content
 * @param content - The markdown content with import statements
 * @param filePath - The path of the file containing the imports
 * @param importChain - Set of file paths in the current import chain (for circular dependency detection)
 * @param siteDir - Site root, used to resolve `@site/` alias imports (defaults to process.cwd())
 * @returns Content with partials resolved
 */
export async function resolvePartialImports(
  content: string,
  filePath: string,
  importChain: Set<string> = new Set(),
  siteDir: string = process.cwd()
): Promise<string> {
  let resolved = content;

  // Match import statements for partials and JSX usage
  // Pattern 1: import PartialName from './_partial.mdx'
  // Pattern 2: import { PartialName } from './_partial.mdx'
  // Pattern 3: import PartialName from '@site/src/partials/partial.mdx'
  // Create a fresh regex for each invocation to avoid lastIndex state leakage
  const createImportRegex = () => /^\s*import\s+(?:(\w+)|{\s*(\w+)\s*})\s+from\s+['"]([^'"]+\.mdx?)['"];?\s*$/gm;
  const imports = new Map<string, string>();

  // First pass: collect all imports
  let match;
  const importRegex = createImportRegex();
  while ((match = importRegex.exec(content)) !== null) {
    const componentName = match[1] || match[2];
    const importPath = match[3];

    // The regex only matches .mdx/.md specifiers, so React/component imports
    // are never collected. Any markdown import — partial or whole page body —
    // is inlined (#65: the previous '_'/'/partials/' gate silently dropped
    // page bodies imported as normally-named .mdx components).
    imports.set(componentName, importPath);
  }

  // Resolve each partial import
  for (const [componentName, importPath] of imports) {
    try {
      // Resolve the partial file path relative to the current file, against
      // the site directory for '@site/' alias imports, or — for other
      // webpack-style aliases like '@global/components/x.mdx' — against the
      // site directory using the convention that an alias points at a
      // top-level site directory (#65).
      const dir = path.dirname(filePath);
      let partialPath: string;
      if (importPath.startsWith('@site/')) {
        partialPath = path.resolve(siteDir, importPath.slice('@site/'.length));
      } else if (/^@[\w-]+\//.test(importPath)) {
        const withoutAt = importPath.slice(1);
        const [aliasName, ...rest] = withoutAt.split('/');
        partialPath = path.resolve(siteDir, aliasName, ...rest);
      } else {
        partialPath = path.resolve(dir, importPath);
      }

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
        const jsxRegex = new RegExp(`<${escapedComponentName}${TAG_ATTRS}\\/?>(?:[\\s\\S]*?<\\/${escapedComponentName}>)?`, 'gm');
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
      const resolvedPartial = await resolvePartialImports(partialMarkdown, partialPath, newChain, siteDir);

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
      const jsxRegex = new RegExp(`<${escapedComponentName}${TAG_ATTRS}(?:/>|>[^<]*</${escapedComponentName}>)`, 'g');
      // Drop the partial's own import lines before splicing: they reference
      // components (e.g. '@theme/Tabs') that are meaningless in plain
      // markdown, and inside list context they would leak as literal text.
      //
      // Mask code first: a Swift or Kotlin sample inside the partial can open
      // with `import Foundation`, which the line-based strip below would
      // otherwise delete from the middle of the fence.
      const { masked: maskedPartial, restore: restorePartial } =
        maskCodeSegments(resolvedPartial);
      const partialInlined = restorePartial(
        maskedPartial
          .replace(/^\s*import\s+.*$/gm, '')
          .replace(/\n{3,}/g, '\n\n')
      ).trim();
      resolved = resolved.replace(jsxRegex, partialInlined);

    } catch (error: unknown) {
      logger.warn(`Failed to resolve partial import '${importPath}' (imported by ${filePath}): ${getErrorMessage(error)}`);

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
      const jsxRegex = new RegExp(`<${escapedComponentName}${TAG_ATTRS}\\/?>(?:[\\s\\S]*?<\\/${escapedComponentName}>)?`, 'gm');
      resolved = resolved.replace(jsxRegex, '');
    }
  }

  return resolved;
}

/**
 * Extract an attribute value from a JSX tag's attribute run: the value of
 * `name`, whether double-quoted, single-quoted, or a brace expression.
 */
function extractTagAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{([^{}]*)\\})`));
  const raw = m?.[1] ?? m?.[2] ?? m?.[3];
  return isNonEmptyString(raw) ? raw : undefined;
}

/**
 * Clean markdown content for LLM consumption
 * @param content - Raw markdown content
 * @param excludeImports - Whether to exclude import statements
 * @param removeDuplicateHeadings - Whether to remove redundant content that duplicates heading text
 * @param preserveComponents - PascalCase component names whose tags are left untouched
 * @returns Cleaned content
 */
export function cleanMarkdownContent(content: string, excludeImports: boolean = false, removeDuplicateHeadings: boolean = false, preserveComponents: string[] = []): string {
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
  cleaned = cleaned.replace(
    new RegExp(`</?(?:div|span|p|br|hr|img|a|strong|em|b|i|u|h[1-6]|ul|ol|li|table|tr|td|th|thead|tbody)\\b${TAG_ATTRS}/?>`, 'gi'),
    ''
  );

  // Emit the label of Docusaurus's <TabItem> as a bold line before the tab
  // body (with a `value` fallback, matching what Docusaurus renders). Without
  // this, tab bodies concatenate with nothing distinguishing them and the
  // label prop is silently lost (#64).
  const tabItemOpen = /<TabItem\b[^>]*>/g;
  cleaned = cleaned.replace(tabItemOpen, (tag) => {
    const label = extractTagAttr(tag, 'label') ?? extractTagAttr(tag, 'value');
    return label ? `\n\n**${label}**\n\n` : '';
  });

  // Remove MDX/JSX component tags (PascalCase element names such as <Tabs>,
  // <TabItem>, <Admonition>), keeping their inner text content — except for
  // components the site explicitly opted out of via preserveComponents,
  // whose tags are left untouched in the output.
  const preserve = new Set(preserveComponents);
  const jsxTag = new RegExp(`<(/?)([A-Z][A-Za-z0-9.]*)\\b((?:${TAG_ATTRS}))(/?)>`, 'g');
  cleaned = cleaned.replace(jsxTag, (tag, slash, name, attrs) => {
    if (preserve.has(name)) return tag;
    void attrs;
    return '';
  });

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
