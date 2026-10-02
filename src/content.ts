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

/** Source of unique placeholder-token namespaces (see maskCodeSegments). */
let maskCounter = 0;

/**
 * Mask fenced code blocks (``` / ~~~) and inline code spans with opaque
 * placeholder tokens so that content transforms — HTML/JSX stripping, import
 * removal, image-URL rewriting, heading detection — never alter code samples.
 * Returns the masked string plus a `restore()` that swaps the code back in.
 */
export function maskCodeSegments(content: string): {
  masked: string;
  restore: (s: string) => string;
} {
  const segments: string[] = [];
  // Each call gets its own token namespace, so content masked twice (a caller
  // masks, then resolvePartialImports masks again) restores correctly.
  const id = maskCounter++;
  const store = (code: string): string => {
    const token = `￼CODE${id}:${segments.length}￼`;
    segments.push(code);
    return token;
  };

  // Fenced code blocks first: opening fence (>=3 backticks or tildes) through a
  // closing fence of the same character that is at least as long as the
  // opener (CommonMark), so a ```` fence can show a ``` fence inside it. The
  // leading newline (if any) stays outside the token so line structure is
  // unchanged.
  let masked = content.replace(
    /(^|\n)([ \t]*(?:(`{3,})[^\n]*\n[\s\S]*?\n[ \t]*\3`*|(~{3,})[^\n]*\n[\s\S]*?\n[ \t]*\4~*)[ \t]*)(?=\n|$)/g,
    (_match, lead, block) => `${lead}${store(block)}`,
  );

  // Fences inside blockquotes: every line of the block carries a `>` prefix.
  masked = masked.replace(
    /(^|\n)([ \t]*>(?:[ \t]*>)*[ \t]*(?:(`{3,})[^\n]*(?:\n[ \t]*>[^\n]*?)*?\n[ \t]*>(?:[ \t]*>)*[ \t]*\3`*|(~{3,})[^\n]*(?:\n[ \t]*>[^\n]*?)*?\n[ \t]*>(?:[ \t]*>)*[ \t]*\4~*)[ \t]*)(?=\n|$)/g,
    (_match, lead, block) => `${lead}${store(block)}`,
  );

  // Then inline code spans (`code`, ``co`de``) — a span never crosses a line.
  masked = masked.replace(/(`+)(?:(?!\1)[^\n])+?\1/g, (m) => store(m));

  const restore = (s: string): string =>
    s.replace(new RegExp(`￼CODE${id}:(\\d+)￼`, 'g'), (_t, i) => segments[Number(i)] ?? '');

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
  return path
    .basename(filePath, path.extname(filePath))
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
 * single-quoted, a JSX brace expression, or bare. A bare value cannot start
 * with a quote or brace, so each value has one way to match: with overlapping
 * alternatives, a long tag that fails to match backtracks exponentially.
 * Brace expressions are matched to one nesting level only; a deeper expression
 * makes the whole tag fail to match and stay intact in the output, which is
 * the safe failure direction (visible leftover rather than silent corruption).
 */
const TAG_ATTRS =
  /(?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\}|[^\s>"'{][^\s>]*))?)*\s*/
    .source;

/**
 * Regex source matching one ES import statement on its own line(s): `import
 * X from '...'`, `import { a, b } from '...'` (braces may span lines),
 * `import * as ns from '...'`, `import X, { a } from '...'`, or a side-effect
 * `import '...'`. A line of prose that starts with "import" has no quoted
 * module specifier and never matches.
 */
const IMPORT_STATEMENT =
  /^[ \t]*import\s+(?:(?:type\s+)?(?:[\w$]+(?:\s*,\s*(?:\{[^}]*\}|\*\s*as\s+[\w$]+))?|\{[^}]*\}|\*\s*as\s+[\w$]+)\s*from\s*)?['"][^'"\n]+['"][ \t]*;?[ \t]*$/
    .source;

/** Remove ES import statements, leaving every other line as written. */
function stripImportStatements(content: string): string {
  return content.replace(new RegExp(IMPORT_STATEMENT, 'gm'), '');
}

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
  siteDir: string = process.cwd(),
): Promise<string> {
  // Mask code at every recursion level: an import or `<Partial />` shown in a
  // code sample is documentation, never a real import or usage.
  const { masked, restore } = maskCodeSegments(content);
  let resolved = masked;

  // Inlined partial bodies are parked behind tokens until the end, so a later
  // splice cannot reach into an earlier partial's content (e.g. a `<B />`
  // inside partial A's code sample).
  const inlined: string[] = [];
  const partialId = maskCounter++;
  const park = (body: string): string => {
    const token = `￼PARTIAL${partialId}:${inlined.length}￼`;
    inlined.push(body);
    return token;
  };

  // Match import statements for partials and JSX usage
  // Pattern 1: import PartialName from './_partial.mdx'
  // Pattern 2: import { PartialName } from './_partial.mdx'
  // Pattern 3: import { default as PartialName } from './_partial.mdx'
  // Pattern 4: import PartialName, { toc } from './_partial.mdx'
  // Pattern 5: import PartialName from '@site/src/partials/partial.mdx'
  // Create a fresh regex for each invocation to avoid lastIndex state leakage
  const createImportRegex = () =>
    /^[ \t]*import\s+(?:([\w$]+)(?:\s*,\s*\{[^}]*\})?|\{\s*(?:default\s+as\s+)?([\w$]+)\s*\})\s*from\s*['"]([^'"]+\.mdx?)['"][ \t]*;?[ \t]*$/gm;
  const imports = new Map<string, { importPath: string; statement: string }>();

  // First pass: collect all imports
  let match;
  const importRegex = createImportRegex();
  while ((match = importRegex.exec(masked)) !== null) {
    const componentName = match[1] || match[2];
    const importPath = match[3];

    // The regex only matches .mdx/.md specifiers, so React/component imports
    // are never collected. Any markdown import — partial or whole page body —
    // is inlined (#65: the previous '_'/'/partials/' gate silently dropped
    // page bodies imported as normally-named .mdx components).
    imports.set(componentName, { importPath, statement: match[0] });
  }

  // Remove an import statement as written (every copy of it).
  const removeStatement = (statement: string): void => {
    resolved = resolved.split(statement).join('');
  };

  // Resolve each partial import
  for (const [componentName, { importPath, statement }] of imports) {
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

        // Escape special regex characters in component name
        const escapedComponentName = escapeRegex(componentName);

        // Remove the import statement to prevent infinite recursion
        removeStatement(statement);

        // Remove JSX usage of this component
        const jsxRegex = new RegExp(
          `<${escapedComponentName}${TAG_ATTRS}\\/?>(?:[\\s\\S]*?<\\/${escapedComponentName}>)?`,
          'gm',
        );
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
      const resolvedPartial = await resolvePartialImports(
        partialMarkdown,
        partialPath,
        newChain,
        siteDir,
      );

      // Escape special regex characters in component name
      const escapedComponentName = escapeRegex(componentName);

      // Remove the import statement
      removeStatement(statement);

      // Replace JSX usage with the partial content
      // Handle both self-closing tags and tags with content
      // <PartialName /> or <PartialName></PartialName> or <PartialName>...</PartialName>
      // MDX renders the partial's own body for the tag, so children appear
      // only where the partial renders `{props.children}`.
      const jsxRegex = new RegExp(
        `<${escapedComponentName}${TAG_ATTRS}(?:/>|>([\\s\\S]*?)</${escapedComponentName}>)`,
        'g',
      );
      // Drop the partial's own import lines before splicing: they reference
      // components (e.g. '@theme/Tabs') that are meaningless in plain
      // markdown, and inside list context they would leak as literal text.
      //
      // Mask code first: a Swift or Kotlin sample inside the partial can open
      // with `import Foundation`, which the line-based strip below would
      // otherwise delete from the middle of the fence.
      const { masked: maskedPartial, restore: restorePartial } = maskCodeSegments(resolvedPartial);
      const partialInlined = restorePartial(
        stripImportStatements(maskedPartial).replace(/\n{3,}/g, '\n\n'),
      ).trim();
      // Function form: a string replacement would interpret `$` sequences
      // ($&, $1, $$, $' ...) in the partial's content — corrupting shell
      // samples like `echo $1` or `kill $$` that are extremely common in
      // documentation code blocks.
      resolved = resolved.replace(jsxRegex, (_tag, children?: string) =>
        park(
          isDefined(children) && partialInlined.includes('{props.children}')
            ? partialInlined.split('{props.children}').join(children.trim())
            : partialInlined,
        ),
      );
    } catch (error: unknown) {
      logger.warn(
        `Failed to resolve partial import '${importPath}' (imported by ${filePath}): ${getErrorMessage(error)}`,
      );

      // Remove both the import statement AND the JSX usage even if partial can't be resolved
      // This prevents leaving broken references in the output

      // Escape special regex characters in component name
      const escapedComponentName = escapeRegex(componentName);

      // Remove the import statement
      removeStatement(statement);

      // Remove JSX usage of this component
      // Handle both self-closing tags (<Component />) and regular tags with content (<Component>...</Component>)
      const jsxRegex = new RegExp(
        `<${escapedComponentName}${TAG_ATTRS}\\/?>(?:[\\s\\S]*?<\\/${escapedComponentName}>)?`,
        'gm',
      );
      resolved = resolved.replace(jsxRegex, '');
    }
  }

  return restore(
    resolved.replace(
      new RegExp(`￼PARTIAL${partialId}:(\\d+)￼`, 'g'),
      (_t, i) => inlined[Number(i)] ?? '',
    ),
  );
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
 * Extract a quoted HTML attribute value from a tag. The name must follow
 * whitespace, so `src` never matches inside `data-src`.
 */
function quotedTagAttr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  const raw = m?.[1] ?? m?.[2];
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
export function cleanMarkdownContent(
  content: string,
  excludeImports: boolean = false,
  removeDuplicateHeadings: boolean = false,
  preserveComponents: string[] = [],
): string {
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
    // Multi-line `import {\n  A,\n} from '...'` is removed whole; prose that
    // starts with "import" is left alone.
    cleaned = stripImportStatements(cleaned);
  }

  // Remove MDX `{/* ... */}` and HTML `<!-- ... -->` comments (code is masked,
  // so a comment shown in a code sample stays).
  cleaned = cleaned.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/<!--[\s\S]*?-->/g, '');

  // Convert <img> to a markdown image, keeping its alt text; image-URL
  // rewriting runs after cleaning and then applies to the src too.
  cleaned = cleaned.replace(new RegExp(`<img\\b${TAG_ATTRS}/?>`, 'gi'), (tag) => {
    const src = quotedTagAttr(tag, 'src');
    return src ? `![${quotedTagAttr(tag, 'alt') ?? ''}](${src})` : '';
  });

  // Remove common HTML tags (code blocks are already masked out above),
  // keeping the text boundaries they marked: adjacent table cells get a ` | `
  // separator, and a run of block-level tags becomes one newline (a space
  // inside a markdown table row, where a newline would break the row).
  cleaned = cleaned.replace(new RegExp(`</t[dh]\\s*>\\s*<t[dh]\\b${TAG_ATTRS}>`, 'gi'), ' | ');
  const blockTag = `</?(?:div|p|br|hr|h[1-6]|ul|ol|li|table|tr|td|th|thead|tbody)\\b${TAG_ATTRS}/?>`;
  cleaned = cleaned.replace(
    new RegExp(`(?:${blockTag}[ \\t]*)+`, 'gi'),
    (_run, offset: number, str: string) => {
      const lineStart = str.lastIndexOf('\n', offset - 1) + 1;
      return /^[ \t]*\|/.test(str.slice(lineStart, offset)) ? ' ' : '\n';
    },
  );
  cleaned = cleaned.replace(
    new RegExp(`</?(?:span|a|strong|em|b|i|u)\\b${TAG_ATTRS}/?>`, 'gi'),
    '',
  );

  // Emit the label of Docusaurus's <TabItem> as a bold line before the tab
  // body (with a `value` fallback, matching what Docusaurus renders). Without
  // this, tab bodies concatenate with nothing distinguishing them and the
  // label prop is silently lost (#64). TAG_ATTRS keeps the match alive through
  // `>` inside quoted values (e.g. label="A > B"); a [^>]* scan would cut the
  // tag short and leak the remainder as prose.
  const tabItemOpen = new RegExp(`<TabItem\\b${TAG_ATTRS}>`, 'g');
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

  // Collapse blank lines outside code: removed tags leave whitespace-only
  // lines and runs of newlines. Code is still masked, so blank lines inside a
  // code sample stay as written.
  cleaned = cleaned
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]+(?=\n)/g, '\n')
    .replace(/\n{3,}/g, '\n\n');

  // Restore the masked code blocks / inline code.
  cleaned = restore(cleaned).trim();

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
  frontMatter?: Record<string, any>,
): string {
  let result = '';

  // Add frontmatter if provided
  if (isDefined(frontMatter) && Object.keys(frontMatter).length > 0) {
    result += '---\n';
    result += YAML.stringify(frontMatter, {
      lineWidth: 0,
      defaultStringType: 'QUOTE_DOUBLE',
      defaultKeyType: 'PLAIN',
    });
    result += '---\n\n';
  }

  // Blockquote every line so a multi-line description stays a valid markdown
  // blockquote; quoting only the first would leave later lines as prose under
  // the heading.
  const blockquoted = description
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  const descriptionLine = includeMetadata && description ? `\n\n${blockquoted}\n` : '\n';

  result +=
    `# ${title}${descriptionLine}
${content}`.trim() + '\n';

  return result;
}

/**
 * Strip a paragraph line that exactly matches `description` — used when a
 * generated file already emits the description as a blockquote header, so a
 * body paragraph identical to it is not emitted twice. Comparison is
 * line-by-line with code fences skipped, so inline code stays literal: a
 * description containing `backticks` still matches (a regex run over masked
 * text would fail here, because masking also hides inline code). Only an
 * exact, standalone match is removed; anything else is left as written.
 */
export function stripDuplicateDescriptionParagraph(content: string, description: string): string {
  if (!isNonEmptyString(description)) return content;
  const descLines = description
    .trim()
    .split('\n')
    .map((l) => l.trim());
  const lines = content.split('\n');
  let inFence = false;
  let fenceChar = '';
  for (let i = 0; i + descLines.length <= lines.length; i++) {
    const line = lines[i];
    const fenceMatch = /^([ \t]*)(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceChar = fenceMatch[2][0];
      } else if (fenceChar === fenceMatch[2][0]) {
        inFence = false;
        fenceChar = '';
      }
      continue;
    }
    if (inFence) continue;
    // The description's lines must match consecutive body lines verbatim
    // (single- or multi-line paragraph), and the block must end at a blank
    // line or end of content so a prefix of a longer paragraph never matches.
    const candidate = lines.slice(i, i + descLines.length).map((l) => l.trim());
    const blockEnd = lines[i + descLines.length];
    if (
      candidate.join('\n') === descLines.join('\n') &&
      (blockEnd === undefined || blockEnd.trim() === '')
    ) {
      // Remove the paragraph block plus the blank lines that follow it, so
      // the gap does not double; a mid-body match keeps one blank-line gap
      // between the surviving neighbors instead of joining their paragraphs.
      let j = i + descLines.length;
      while (j < lines.length && lines[j].trim() === '') j++;
      const wasMidBody = i > 0;
      lines.splice(i, j - i);
      let out = lines.join('\n');
      if (wasMidBody) out = out.replace(/\n{3,}/g, '\n\n');
      return out.replace(/^[ \t\n]+/, '');
    }
  }
  return content;
}

/**
 * Demote every markdown heading by one level (H1 -> H2, H2 -> H3, ...), leaving
 * code fences and inline code untouched. Used when a document is embedded
 * under a parent heading (llms-full.txt), so the document's own structure
 * stays nested under the parent instead of colliding with it.
 */
export function demoteHeadings(content: string): string {
  const { masked, restore } = maskCodeSegments(content);
  const demoted = masked.replace(/^(#{1,5})(\s)/gm, '$1#$2');
  return restore(demoted);
}

/**
 * Strip a leading heading line when its text matches `title` exactly — used
 * when a generated file already emits `# {title}` as its header, so the body's
 * own identical H1 is not emitted twice. Code fences are masked first, so a
 * sample beginning with the same heading is left as written.
 */
export function stripDuplicateTitleHeading(content: string, title: string): string {
  if (!isNonEmptyString(title)) return content;
  const { masked, restore } = maskCodeSegments(content);
  // Build the regex from the title with regex metacharacters escaped, since
  // titles routinely contain `.`, `(`, `)`, `*`, and other markup characters.
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
  const re = new RegExp(`^#{1,6}\\s+${escapedTitle}[ \\t]*$`, 'm');
  const stripped = masked.replace(re, '');
  return restore(stripped).replace(/^\n+/, '').trimStart();
}
