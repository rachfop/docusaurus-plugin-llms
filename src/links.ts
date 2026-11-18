/** Rewrites links between documentation pages in generated Markdown content. */

import * as path from 'path';
import { maskCodeSegments } from './content';

/** Column width of a whitespace run, with tabs advancing to the next stop. */
function indentWidth(whitespace: string): number {
  let width = 0;
  for (const character of whitespace) {
    width = character === '\t' ? Math.floor(width / 4) * 4 + 4 : width + 1;
  }
  return width;
}

/** Drop the blockquote markers a line starts with, keeping the rest. */
function stripBlockquotePrefix(line: string): string {
  let rest = line;
  for (;;) {
    const marker = /^[ \t]{0,3}>[ \t]?/.exec(rest);
    if (!marker) return rest;
    rest = rest.slice(marker[0].length);
  }
}

/**
 * Content column of a list item, when the line starts one.
 *
 * A marker followed by one to four spaces places the item's content after the
 * whole run; a longer run leaves the content one space past the marker and
 * indents the remainder as a code block inside the item.
 */
function listItemContentIndent(line: string): number | undefined {
  const marker = /^([ \t]*)([-*+]|\d{1,9}[.)])([ \t]+)/.exec(line);
  if (!marker) return undefined;
  const gap = indentWidth(marker[3]);
  return indentWidth(marker[1]) + marker[2].length + (gap > 4 ? 1 : gap);
}

/**
 * Content column of the innermost list item that can hold the next line.
 *
 * Blank lines stay inside an item. A block that starts at column zero and is
 * not a list item ends the item above it, so the scan stops there.
 */
function enclosingListContentIndent(linesBefore: readonly string[]): number | undefined {
  for (let index = linesBefore.length - 1; index >= 0; index--) {
    const line = stripBlockquotePrefix(linesBefore[index]);
    if (!/\S/.test(line)) continue;
    const contentIndent = listItemContentIndent(line);
    if (contentIndent !== undefined) return contentIndent;
    if (!/^[ \t]/.test(line)) return undefined;
  }
  return undefined;
}

/**
 * Whether the text before a link puts that link inside an indented code block.
 *
 * The four-column rule counts from the enclosing container's content column,
 * measured after any blockquote markers. Inside a list item, indentation
 * between the content column and that column plus four continues the item's
 * paragraph, so such a link is ordinary text. A line directly under a
 * paragraph line continues that paragraph: an indented code block cannot
 * interrupt one.
 *
 * @param linePrefix - Text from the start of the link's line through the link's opening
 * @param text - The document being rewritten, with code segments masked
 * @param lineStart - Offset of the link's line within `text`
 */
function startsIndentedCode(linePrefix: string, text: string, lineStart: number): boolean {
  const unquoted = stripBlockquotePrefix(linePrefix);
  const indent = indentWidth(/^[ \t]*/.exec(unquoted)?.[0] ?? '');
  if (indent < 4) return false;
  const linesBefore = text.slice(0, lineStart).split('\n');
  const previousLine = linesBefore.length >= 2 ? linesBefore[linesBefore.length - 2] : undefined;
  const contentIndent = enclosingListContentIndent(linesBefore);
  if (contentIndent !== undefined) return indent >= contentIndent + 4 || indent < contentIndent;
  return !continuesParagraph(previousLine);
}

/** A line that opens a block construct, which a following indented line cannot continue. */
const blockStartRe =
  /^[ \t]*(?:#{1,6}[ \t]|>|[-*+][ \t]|\d{1,9}[.)][ \t]|`{3,}|~{3,}|\[|<|\||[-*_]{3,}[ \t]*$|={1,}[ \t]*$)/;

/**
 * Whether an indented line directly under `previousLine` continues its
 * paragraph. A blank line, a block construct, masked code, or an earlier
 * indented line ends the paragraph, so the indented line opens a code block
 * instead.
 */
function continuesParagraph(previousLine: string | undefined): boolean {
  if (previousLine === undefined) return false;
  // Masked code leaves a placeholder token on the line it replaced.
  if (/[\u{FFFC}]/u.test(previousLine)) return false;
  const line = stripBlockquotePrefix(previousLine);
  if (!/\S/.test(line)) return false;
  if (/^[ \t]{4,}/.test(line) || line.startsWith('\t')) return false;
  return !blockStartRe.test(line);
}

/** Split a link destination into its file path and query/fragment suffix. */
function splitDestination(destination: string): { pathname: string; suffix: string } {
  const suffixAt = destination.search(/[?#]/);
  return suffixAt === -1
    ? { pathname: destination, suffix: '' }
    : { pathname: destination.slice(0, suffixAt), suffix: destination.slice(suffixAt) };
}

/**
 * Rewrite relative links between documents to their generated Markdown URLs.
 * Inline and reference-style links are handled; images, absolute URLs,
 * root-relative links, unresolved destinations, and code samples stay as
 * written. Query strings and fragments are preserved.
 *
 * @param content - Markdown content to transform
 * @param sourcePath - Site-relative source path of the document
 * @param targets - Site-relative document source paths to generated URLs
 * @param useRelativeUrls - Emit origin-relative rather than absolute URLs
 */
export function rewriteRelativeDocLinks(
  content: string,
  sourcePath: string,
  targets: ReadonlyMap<string, string>,
  useRelativeUrls: boolean = false,
): string {
  const { masked, restore } = maskCodeSegments(content);

  const resolve = (destination: string): string | undefined => {
    if (/^(?:[a-z][a-z0-9+.-]*:|[/#?~@])/i.test(destination)) return undefined;

    const { pathname, suffix } = splitDestination(destination);
    if (!pathname) return undefined;

    let decodedPath: string;
    try {
      decodedPath = decodeURIComponent(pathname);
    } catch {
      decodedPath = pathname;
    }

    const resolvedPath = path.posix.normalize(
      path.posix.join(path.posix.dirname(sourcePath), decodedPath),
    );

    const candidates = [resolvedPath];
    if (!/\.mdx?$/i.test(resolvedPath)) {
      candidates.push(
        `${resolvedPath}.md`,
        `${resolvedPath}.mdx`,
        `${resolvedPath}/index.md`,
        `${resolvedPath}/index.mdx`,
        `${resolvedPath}/README.md`,
        `${resolvedPath}/README.mdx`,
      );
    }

    for (const candidate of candidates) {
      const target = targets.get(candidate);
      if (!target) continue;
      if (!useRelativeUrls) return `${target}${suffix}`;
      try {
        const url = new URL(target);
        return `${url.pathname}${url.search}${url.hash}${suffix}`;
      } catch {
        return `${target}${suffix}`;
      }
    }
    return undefined;
  };

  const replaceLink = (
    text: string,
    match: string,
    prefix: string,
    angleDestination: string | undefined,
    plainDestination: string | undefined,
    offset: number,
  ): string => {
    const lineStart = text.lastIndexOf('\n', offset - 1) + 1;
    const linePrefix = text.slice(lineStart, offset) + prefix;
    if (startsIndentedCode(linePrefix, text, lineStart)) return match;

    const destination = angleDestination ?? plainDestination ?? '';
    const rewritten = resolve(destination);
    if (!rewritten) return match;
    return `${prefix}${angleDestination !== undefined ? `<${rewritten}>` : rewritten}`;
  };

  // A leading ! makes this an image, not a page link. Link text accepts one
  // level of nested brackets and escaped characters, so a linked image
  // (`[![badge](./b.svg)](./page.md)`) and text such as `[the [install] steps]`
  // match. Plain destinations accept escapes and balanced parentheses; a title
  // after whitespace stays outside the matched portion.
  const inlineLinkRe =
    /(?<!!)(\[(?:[^[\]\\]|\\.|\[(?:[^[\]\\]|\\.)*\])*\]\()(?:<([^<>\n]+)>|((?:\\.|[^\\()\s<>]|\((?:\\.|[^\\()\s<>])*\))+))/g;
  // A footnote definition (`[^1]: ...`) is not a link definition, so its body
  // stays as written.
  const referenceDefinitionRe =
    /(^[ \t]*(?:>[ \t]*)*[ \t]{0,3}\[(?!\^)[^\]]+\]:[ \t]*)(?:<([^<>\n]+)>|(\S+))/gm;

  const withReferences = masked.replace(
    referenceDefinitionRe,
    (match, prefix, angleDestination, plainDestination, offset) =>
      replaceLink(masked, match, prefix, angleDestination, plainDestination, offset),
  );
  const rewritten = withReferences.replace(
    inlineLinkRe,
    (match, prefix, angleDestination, plainDestination, offset) =>
      replaceLink(withReferences, match, prefix, angleDestination, plainDestination, offset),
  );
  return restore(rewritten);
}
