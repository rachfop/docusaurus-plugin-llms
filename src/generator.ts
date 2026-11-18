/**
 * LLM file generation functions for the docusaurus-plugin-llms plugin
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { CustomLLMFile, DocInfo, DocsSection, MarkdownPathRegistry, PluginContext } from './types';
import {
  writeFile,
  readMarkdownFiles,
  sanitizeForFilename,
  ensureUniqueIdentifier,
  createMarkdownContent,
  normalizePath,
  validatePathLength,
  shortenPathIfNeeded,
  logger,
  getErrorMessage,
  isNonEmptyString,
  isNonEmptyArray,
  isDefined,
  getSiteBasePath,
  stripSiteBasePath,
  stripNumberPrefix,
  isPathInside,
  joinSiteRelativeUrl,
  encodeUrlPathSegments,
  decodeUrlPathSegments,
  rewriteRelativeDocLinks,
} from './utils';
import { processFilesWithPatterns } from './processor';
import {
  demoteHeadings,
  stripDuplicateTitleHeading,
  stripDuplicateDescriptionParagraph,
} from './content';

/**
 * Whether a path names something on disk. Used to decide whether a shared
 * copy already exists, so a prefixed version does not rewrite the root's file.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Collapse every whitespace run (including newlines) in a title to one space,
 * so the title stays on a single markdown line.
 */
function singleLineTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim();
}

/**
 * Format a title as markdown link text: one line, with `\`, `[`, and `]`
 * backslash-escaped so the title can't close the link early or nest a link.
 */
function escapeLinkText(title: string): string {
  return singleLineTitle(title).replace(/[\\[\]]/g, '\\$&');
}

/**
 * Clean a description for use in a TOC item
 * @param description - The original description
 * @param fromFrontMatter - Whether the description came from front matter
 * @returns Cleaned description suitable for TOC
 */
function cleanDescriptionForToc(description: string, fromFrontMatter: boolean = true): string {
  if (!isNonEmptyString(description)) return '';

  // A front matter description contributes its first line. A description
  // taken from the page body is its first paragraph, whose lines are often
  // hard-wrapped, so its lines are joined into one.
  const lines = description.split('\n');
  const firstLine = fromFrontMatter ? (lines.length > 0 ? lines[0] : '') : lines.join(' ');

  // Remove heading markers only at the beginning of the line
  // Be careful to only remove actual heading markers (# followed by space at beginning)
  // and not hashtag symbols that are part of the content (inline hashtags)
  let cleaned = firstLine
    .replace(/^(#+)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Body text often carries links relative to the page (`./installation.md`),
  // which mean nothing in llms.txt, so a body description keeps link text only.
  if (!fromFrontMatter) {
    cleaned = cleaned.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  }

  // Truncate if too long (150 characters max with ellipsis). A front matter
  // description cut to its first line can also leave a code span or link
  // open (it closes on a later line); that line is balanced and marked as cut
  // too, and a first line with nothing open is kept as written.
  if (cleaned.length <= 150) {
    if (!fromFrontMatter || lines.length < 2) return cleaned;
    const balanced = cutBeforeOpenSpan(cleaned);
    if (balanced === cleaned) return cleaned;
    return balanced ? `${balanced}...` : '';
  }
  return `${cutBeforeOpenSpan(cleaned.substring(0, 147))}...`;
}

/**
 * Cut text before an unclosed code span or link opener: a cut inside one
 * would leave it open and break the TOC line's markdown.
 */
function cutBeforeOpenSpan(text: string): string {
  let cut = text;
  if ((cut.match(/`/g) || []).length % 2 === 1) {
    cut = cut.substring(0, cut.lastIndexOf('`')).trimEnd();
  }
  const openLink = cut.search(/!?\[[^\]]*$|!?\[[^\]]*\]\([^)]*$/);
  if (openLink !== -1) {
    cut = cut.substring(0, openLink).trimEnd();
  }
  return cut;
}

/**
 * Append .md to a URL per the llmstxt.org spec, stripping any trailing
 * slashes first.  URLs that already end with .md are returned unchanged.
 */
function applyMdExtension(url: string): string {
  const stripped = url.replace(/\/+$/, '');
  if (stripped.endsWith('.md')) return stripped;
  // A bare origin ('https://site.com/') must keep its slash: appending .md
  // would produce 'https://site.com.md'.
  if (/^[a-z][a-z0-9+.-]*:\/\/[^/]+$/i.test(stripped)) return `${stripped}/`;
  return `${stripped}.md`;
}

/**
 * Convert an absolute URL to an origin-relative one, keeping the path (which
 * includes the site's baseUrl), query, and fragment — e.g.
 * `https://site.com/docs/page.md` → `/docs/page.md`. Non-absolute or unparseable
 * values are returned unchanged.
 */
function toRelativeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

/**
 * Generate an LLM-friendly file
 * @param docs - Processed document information
 * @param outputPath - Path to write the output file
 * @param fileTitle - Title for the file
 * @param fileDescription - Description for the file
 * @param includeFullContent - Whether to include full content or just links
 * @param version - Version of the file
 * @param customRootContent - Optional custom content to include at the root level
 * @param batchSize - Batch size for processing documents (default: 100)
 * @param addMdExtension - Whether to append .md to link URLs (default: true)
 */
export async function generateLLMFile(
  docs: DocInfo[],
  outputPath: string,
  fileTitle: string,
  fileDescription: string,
  includeFullContent: boolean,
  version?: string,
  customRootContent?: string,
  batchSize: number = 100,
  addMdExtension: boolean = true,
  useRelativeUrls: boolean = false,
): Promise<void> {
  // Validate path length before proceeding
  if (!validatePathLength(outputPath)) {
    throw new Error(`Output path exceeds maximum length: ${outputPath}`);
  }

  logger.verbose(`Generating file: ${outputPath}, version: ${version || 'undefined'}`);
  const versionInfo = version ? `\n\nVersion: ${version}` : '';

  if (includeFullContent) {
    // Generate full content file with header deduplication
    // Process documents in batches to prevent memory issues on large sites
    const usedHeaders = new Set<string>();
    const fullContentSections: string[] = [];

    // Process documents in batches
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(docs.length / batchSize);

      if (totalBatches > 1) {
        logger.verbose(
          `Processing batch ${batchNumber}/${totalBatches} (${batch.length} documents)`,
        );
      }

      const batchSections = batch.map((doc) => {
        // Generate unique header using the utility function
        // The header is one line: a newline in the title would end the heading.
        const headerTitle = singleLineTitle(doc.title) || doc.title;
        const uniqueHeader = ensureUniqueIdentifier(headerTitle, usedHeaders, (counter) => {
          // Try to make it more descriptive by adding the file path info if available
          if (isNonEmptyString(doc.path) && counter === 2) {
            const pathParts = doc.path.split('/');
            const folderName = pathParts.length >= 2 ? pathParts[pathParts.length - 2] : '';
            if (isNonEmptyString(folderName)) {
              return ` (${folderName.charAt(0).toUpperCase() + folderName.slice(1)})`;
            }
          }
          return ` (${counter})`;
        });

        // Drop the body's own H1 when it repeats the title (the `## {header}`
        // above already names the document), then demote every remaining heading
        // one level so the document's inner structure stays nested under its
        // parent section header instead of colliding with it.
        const body = demoteHeadings(stripDuplicateTitleHeading(doc.content, doc.title)).trim();

        return `## ${uniqueHeader}\n\n${body}`;
      });

      fullContentSections.push(...batchSections);
    }

    // Use custom root content or default message
    const rootContent =
      customRootContent ||
      'This file contains all documentation content in a single document following the llmstxt.org standard.';

    const llmFileContent = createMarkdownContent(
      fileTitle,
      `${fileDescription}${versionInfo}`,
      `${rootContent}\n\n${fullContentSections.join('\n\n---\n\n')}`,
      true, // include metadata (description)
    );

    try {
      await writeFile(outputPath, llmFileContent);
    } catch (error: unknown) {
      throw new Error(`Failed to write file ${outputPath}: ${getErrorMessage(error)}`);
    }
  } else {
    // Generate links-only file
    const docsHaveSections = docs.some((doc) => doc.section);

    const tocLine = (doc: DocInfo): string => {
      const cleanedDescription = cleanDescriptionForToc(
        doc.description,
        isNonEmptyString(doc.frontMatter?.description),
      );
      let linkUrl =
        addMdExtension && doc.markdownFile !== false ? applyMdExtension(doc.url) : doc.url;
      if (useRelativeUrls) linkUrl = toRelativeUrl(linkUrl);
      return `- [${escapeLinkText(doc.title)}](${linkUrl})${cleanedDescription ? `: ${cleanedDescription}` : ''}`;
    };

    let tocContent: string;

    if (docsHaveSections) {
      // Group docs by section and emit ## Section headings
      const sectionMap = new Map<string, string[]>();
      for (const doc of docs) {
        const sectionKey = doc.section || '';
        if (!sectionMap.has(sectionKey)) {
          sectionMap.set(sectionKey, []);
        }
        sectionMap.get(sectionKey)!.push(tocLine(doc));
      }

      const sectionBlocks: string[] = [];
      for (const [sectionLabel, items] of sectionMap) {
        const heading = isNonEmptyString(sectionLabel) ? `## ${sectionLabel}\n\n` : '';
        sectionBlocks.push(`${heading}${items.join('\n')}`);
      }

      tocContent = sectionBlocks.join('\n\n');
    } else {
      const tocItems = docs.map(tocLine);
      tocContent = `## Table of Contents\n\n${tocItems.join('\n')}`;
    }

    // Use custom root content or default message
    const rootContent =
      customRootContent ||
      'This file contains links to documentation sections following the llmstxt.org standard.';

    const llmFileContent = createMarkdownContent(
      fileTitle,
      `${fileDescription}${versionInfo}`,
      `${rootContent}\n\n${tocContent}`,
      true, // include metadata (description)
    );

    try {
      await writeFile(outputPath, llmFileContent);
    } catch (error: unknown) {
      throw new Error(`Failed to write file ${outputPath}: ${getErrorMessage(error)}`);
    }
  }

  logger.info(`Generated: ${outputPath}`);
}

/**
 * Build a fallback output file path from the source file path when URL resolution
 * is unavailable. Strips the docsDir prefix (when preserveDirectoryStructure is
 * false) and numeric ordering prefixes ("01-", "02-") from every path segment.
 */
function buildFallbackPath(
  docPath: string,
  docsDir: string,
  preserveDirectoryStructure: boolean,
): string {
  let rel = docPath.replace(/^\/+/, '').replace(/\.mdx?$/, '.md');

  if (!preserveDirectoryStructure) {
    rel = rel.replace(new RegExp(`^${docsDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/`), '');
  }

  // Strip numeric ordering prefixes (e.g. "01-intro" → "intro") from each segment
  rel = rel.split('/').map(stripNumberPrefix).join('/');

  return rel;
}

/**
 * Find the docsDir section that owns a doc by matching its filesystem path
 * against each section's `path`.
 */
function findSectionForDoc(doc: DocInfo, docsSections?: DocsSection[]): DocsSection | undefined {
  return docsSections?.find((s) => {
    const sectionPath = s.path.replace(/^\/+|\/+$/g, '');
    return doc.path === sectionPath || doc.path.startsWith(`${sectionPath}/`);
  });
}

/**
 * Generate individual markdown files for each document
 * @param docs - Processed document information
 * @param outputDir - Directory to write the markdown files
 * @param siteUrl - Base site URL
 * @param docsDir - The configured docs directory name (e.g., 'docs', 'documentation', etc.); used as a fallback for docs that don't match any entry in `docsSections`
 * @param keepFrontMatter - Array of frontmatter keys to preserve in generated files
 * @param preserveDirectoryStructure - Whether to preserve the full directory structure (default: true)
 * @param docsSections - Configured docsDir sections, used to resolve each doc's own filesystem path and routeBasePath
 * @param versionPath - The version's path prefix ('stable'); outputDir is that version's subdirectory, so the prefix is stripped from URLs before mapping them to files and added back to the links
 * @param registry - Paths already assigned in outputDir by an earlier call; a doc found here reuses its file
 * @param unversionedOutputDir - Directory for pages no version owns (blog posts); they keep their unprefixed links and are written once, at the site root
 * @param useRelativeUrls - Whether rewritten links between docs use origin-relative URLs
 * @returns Updated docs with new URLs pointing to generated markdown files
 */
export async function generateIndividualMarkdownFiles(
  docs: DocInfo[],
  outputDir: string,
  siteUrl: string,
  docsDir: string = 'docs',
  keepFrontMatter: string[] = [],
  preserveDirectoryStructure: boolean = true,
  docsSections?: DocsSection[],
  versionPath: string = '',
  registry: MarkdownPathRegistry = {
    usedPaths: new Set(),
    docPaths: new Map(),
    markdownUrls: new Map(),
  },
  unversionedOutputDir?: string,
  useRelativeUrls: boolean = false,
): Promise<DocInfo[]> {
  const updatedDocs: DocInfo[] = [];
  const plannedDocs: Array<{
    doc: DocInfo;
    versionPath: string;
    filePath: string;
    fullPath: string;
    reused: boolean;
    /** A copy the version at the site root owns; a prefixed version leaves it alone. */
    shared: boolean;
  }> = [];
  const { usedPaths } = registry;
  // Callers can omit the link cache; initialize it on first use.
  registry.markdownUrls ??= new Map<string, string>();
  // Only earlier calls' assignments are reused: docs passed to this call that
  // share a path still get their own, suffixed files.
  const earlierDocPaths = new Map(registry.docPaths);

  // The site's baseUrl must be stripped from each doc's URL pathname before
  // deriving the physical file location, since Docusaurus writes its own build
  // output relative to the output root *without* the baseUrl segment and relies
  // on the hosting platform to mount the whole output under baseUrl. Leaving it
  // in would nest generated files one level too deep, effectively applying
  // baseUrl twice on disk.
  const siteBasePath = getSiteBasePath(siteUrl);

  for (const doc of docs) {
    // Unversioned content (blog posts) carries no version prefix in its route,
    // so its markdown file belongs at the site root: the version written at the
    // root already emits it, and a prefixed version links that copy instead of
    // writing a second one inside its own directory.
    const unversionedDir =
      doc.unversioned && isNonEmptyString(unversionedOutputDir) ? unversionedOutputDir : undefined;
    const docOutputDir = unversionedDir ?? outputDir;
    const docVersionPath = unversionedDir ? '' : versionPath;
    // The route of unversioned content carries no version prefix, so its links
    // resolve against the pages at the site root. Only the version written
    // there owns the shared copy; a prefixed version contributes content to its
    // own outputs without rewriting that file.
    const shared = unversionedDir !== undefined && versionPath !== '';

    // A doc an earlier pass already wrote keeps that file, so the standard and
    // custom outputs link to the same page and neither overwrites the other.
    const assignedPath = earlierDocPaths.get(doc.path);
    if (assignedPath !== undefined) {
      plannedDocs.push({
        doc,
        versionPath: docVersionPath,
        filePath: assignedPath,
        fullPath: path.join(docOutputDir, assignedPath),
        reused: true,
        shared,
      });
      continue;
    }

    // Resolve this doc's own section rather than just using the first section's docsDir.
    const matchedSection = findSectionForDoc(doc, docsSections);
    const sectionFsPath = matchedSection?.path ?? docsDir;
    const sectionRouteBasePath = matchedSection?.routeBasePath ?? docsDir;

    // Derive output path from the resolved page URL (already stripped of numeric
    // prefixes like "01-" by Docusaurus). Fallback to doc.path when URL is
    // unavailable or malformed.
    let relativePath: string;

    if (isNonEmptyString(doc.url)) {
      try {
        // Extract clean pathname relative to the baseUrl:
        // "https://site.com/sub/guides/start" → "guides/start.md"
        // The pathname is percent-encoded; files are written under the
        // decoded names ('my file.md', not 'my%20file.md').
        const route = decodeUrlPathSegments(new URL(doc.url).pathname.replace(/\/+$/, '')) || '/';
        let urlPathname = stripSiteBasePath(route, siteBasePath).replace(/^\/+/, '');

        // A version's routes carry its path ('stable/get-started'), but
        // outputDir is already that version's subdirectory.
        if (docVersionPath) {
          if (urlPathname === docVersionPath) {
            urlPathname = '';
          } else if (urlPathname.startsWith(`${docVersionPath}/`)) {
            urlPathname = urlPathname.slice(docVersionPath.length + 1);
          }
        }

        if (urlPathname === '') {
          // Root page (slug: /) → serve as index.md
          relativePath = 'index.md';
        } else {
          // Strip any residual numeric ordering prefixes from each segment.
          // Docusaurus already strips them in resolved URLs, but fallback URLs
          // constructed from the source file path may still contain them.
          let cleanPathname = urlPathname.split('/').map(stripNumberPrefix).join('/');

          // When not preserving directory structure, drop the leading route-base
          // segment so paths are flattened relative to the docs root — matching
          // buildFallbackPath and the pre-existing preserveDirectoryStructure
          // contract (the URL pathname otherwise retains the route base).
          if (!preserveDirectoryStructure && isNonEmptyString(sectionRouteBasePath)) {
            const prefix = `${sectionRouteBasePath.replace(/^\/+|\/+$/g, '')}/`;
            if (cleanPathname.startsWith(prefix)) {
              cleanPathname = cleanPathname.slice(prefix.length);
            }
          }

          // A URL built outside the processor can carry the source file's
          // extension (`config.md`), so its copy keeps that name. A processor
          // route that ends in `.md` keeps the extension too: Docusaurus builds
          // that route as a directory, and the copy sits beside it as
          // `fiber.md.md`.
          if (doc.routeResolved === undefined) {
            cleanPathname = cleanPathname.replace(/\.mdx?$/i, '');
          }

          relativePath = `${cleanPathname}.md`;
        }
      } catch {
        // Malformed URL — fall back to file path with prefix stripping
        relativePath = buildFallbackPath(doc.path, sectionFsPath, preserveDirectoryStructure);
      }
    } else {
      // No URL available — fall back to file path (legacy behaviour)
      relativePath = buildFallbackPath(doc.path, sectionFsPath, preserveDirectoryStructure);
    }

    // The processor's URL already reflects any frontmatter slug/id (whether it
    // came from a route or was derived like Docusaurus derives routes), so the
    // override below applies only to docs built without the processor. For
    // those, an explicit frontmatter slug (or id, the next-best authority) wins
    // over the path derived from the URL.
    const frontMatterOverride =
      doc.routeResolved !== undefined
        ? undefined
        : isNonEmptyString(doc.frontMatter?.slug)
          ? String(doc.frontMatter!.slug)
          : isNonEmptyString(doc.frontMatter?.id)
            ? String(doc.frontMatter!.id)
            : undefined;

    if (frontMatterOverride !== undefined) {
      const override = frontMatterOverride.trim().replace(/^\/+|\/+$/g, '');
      if (isNonEmptyString(override)) {
        if (override.includes('/')) {
          // Nested: mirror the slug's own directory structure.
          relativePath = override + '.md';
        } else {
          // Simple: replace just the filename, keeping the directory.
          const pathParts = relativePath.replace(/\.md$/, '').split('/');
          pathParts[pathParts.length - 1] = override;
          relativePath = pathParts.join('/') + '.md';
        }
      }
    }

    // Trim any leading/trailing whitespace from the path, and drop '.', '..'
    // and empty segments so a slug like '../../x' can't climb out of outputDir.
    relativePath = relativePath
      .trim()
      .split(/[\\/]/)
      .filter((segment) => segment !== '' && segment !== '.' && segment !== '..')
      .join('/');

    // If path is empty, invalid, or still resolves outside outputDir, create a
    // fallback path
    const sanitizedTitle = sanitizeForFilename(doc.title, 'untitled');
    if (!isNonEmptyString(relativePath) || relativePath === '.md') {
      relativePath = `${sanitizedTitle}.md`;
    } else if (!isPathInside(docOutputDir, relativePath)) {
      logger.warn(
        `Markdown path ${relativePath} for ${doc.path} is outside ${docOutputDir}; using ${sanitizedTitle}.md`,
      );
      relativePath = `${sanitizedTitle}.md`;
    }

    // Ensure path uniqueness
    let uniquePath = relativePath;
    let counter = 1;
    const MAX_PATH_ITERATIONS = 10000;
    let pathIterations = 0;

    while (usedPaths.has(uniquePath.toLowerCase())) {
      counter++;
      const pathParts = relativePath.split('.');
      const extension = pathParts.pop() || 'md';
      const basePath = pathParts.join('.');
      uniquePath = `${basePath}-${counter}.${extension}`;

      pathIterations++;
      if (pathIterations >= MAX_PATH_ITERATIONS) {
        // Fallback to timestamp
        const timestamp = Date.now();
        uniquePath = `${basePath}-${timestamp}.${extension}`;
        logger.warn(`Maximum iterations reached for unique path. Using timestamp: ${uniquePath}`);
        break;
      }
    }
    usedPaths.add(uniquePath.toLowerCase());

    // Create the full file path and validate/shorten if needed
    let fullPath = path.join(docOutputDir, uniquePath);
    fullPath = shortenPathIfNeeded(fullPath, docOutputDir, uniquePath);

    // Update uniquePath to reflect the shortened path if it was changed
    if (fullPath !== path.join(docOutputDir, uniquePath)) {
      uniquePath = path.relative(docOutputDir, fullPath);
    }
    registry.docPaths.set(doc.path, uniquePath);

    plannedDocs.push({
      doc,
      versionPath: docVersionPath,
      filePath: uniquePath,
      fullPath,
      reused: false,
      shared,
    });
  }

  // Plan every path before writing any content so a relative link can resolve
  // to its target's generated file, including a target later in the list or
  // one assigned by an earlier standard/custom generation pass.
  const linkTargets = new Map(registry.markdownUrls);
  for (const planned of plannedDocs) {
    const markdownDoc = toMarkdownDocInfo(
      planned.doc,
      siteUrl,
      planned.versionPath,
      planned.filePath,
    );
    linkTargets.set(planned.doc.path, markdownDoc.url);
  }

  const renderMarkdown = (doc: DocInfo, content: string, description: string): string => {
    const preservedFrontMatter: Record<string, any> = {};
    if (isNonEmptyArray(keepFrontMatter) && isDefined(doc.frontMatter)) {
      for (const key of keepFrontMatter) {
        if (key in doc.frontMatter) {
          preservedFrontMatter[key] = doc.frontMatter[key];
        }
      }
    }

    // The generated header supplies the title and description.
    let bodyContent = stripDuplicateTitleHeading(content, doc.title);
    if (isNonEmptyString(description)) {
      bodyContent = stripDuplicateDescriptionParagraph(bodyContent, description);
    }
    return createMarkdownContent(
      doc.title,
      description,
      bodyContent,
      true,
      Object.keys(preservedFrontMatter).length > 0 ? preservedFrontMatter : undefined,
    );
  };

  const failedPlans = new Set<number>();
  const availablePlans = new Set<number>();
  const renderedContents = new Map<number, string>();
  const renderedDescriptions = new Map<number, string>();
  // Plans with a copy the root version owns. They contribute content to this
  // version's outputs and never write the shared file.
  const skippedPlans = new Set<number>();
  // Plans whose file this call created or rewrote. Cleanup after a failure
  // only applies to these: a write that never succeeded can leave a file the
  // plugin did not produce, and removing it would delete build output or a
  // user's own file.
  const writtenPlans = new Set<number>();

  const rewritePlan = (doc: DocInfo, targets: ReadonlyMap<string, string>) => ({
    content: rewriteRelativeDocLinks(doc.content, doc.path, targets, useRelativeUrls),
    description: rewriteRelativeDocLinks(doc.description || '', doc.path, targets, useRelativeUrls),
  });

  const writePlan = async (index: number, content: string, description: string) => {
    const planned = plannedDocs[index];
    try {
      const directory = path.dirname(planned.fullPath);
      try {
        await fs.mkdir(directory, { recursive: true });
      } catch (error: unknown) {
        throw new Error(`Failed to create directory ${directory}: ${getErrorMessage(error)}`);
      }
      try {
        await writeFile(planned.fullPath, renderMarkdown(planned.doc, content, description));
      } catch (error: unknown) {
        throw new Error(`Failed to write file ${planned.fullPath}: ${getErrorMessage(error)}`);
      }
      renderedContents.set(index, content);
      renderedDescriptions.set(index, description);
      writtenPlans.add(index);
      return true;
    } catch (error: unknown) {
      logger.warn(`${getErrorMessage(error)}. Using the HTML route for ${planned.doc.path}`);
      return false;
    }
  };

  const markFailed = async (index: number, content: string, description: string) => {
    const planned = plannedDocs[index];
    failedPlans.add(index);
    availablePlans.delete(index);
    renderedContents.delete(index);
    renderedDescriptions.delete(index);
    updatedDocs[index] = { ...planned.doc, content, description, markdownFile: false };
    // Only a file this call wrote is stale output. When the first write to a
    // path fails, whatever sits there came from somewhere else and stays.
    // A file an earlier pass assigned also stays: the outputs written then
    // already link to it, so removing it turns their links into missing pages.
    if (!writtenPlans.delete(index) || planned.reused) return;
    try {
      // The failed write can leave a partial or stale file behind. The path is
      // a regular file this call created or rewrote, so removing it is safe.
      await fs.rm(planned.fullPath, { force: true });
    } catch {
      // The HTML fallback does not depend on removing the unreadable path.
    }
  };

  for (let index = 0; index < plannedDocs.length; index++) {
    const planned = plannedDocs[index];
    const { doc } = planned;
    const markdownDoc = toMarkdownDocInfo(doc, siteUrl, planned.versionPath, planned.filePath);
    const { content, description } = rewritePlan(doc, linkTargets);

    // The root version writes the shared copy; a prefixed version leaves the
    // file it finds and only uses its own rewritten content in its outputs.
    if (planned.shared && (await fileExists(planned.fullPath))) {
      availablePlans.add(index);
      skippedPlans.add(index);
      updatedDocs.push({ ...markdownDoc, content, description });
      continue;
    }

    if (planned.reused) {
      availablePlans.add(index);
      updatedDocs.push({ ...markdownDoc, content, description });
      // The file came from an earlier call with possibly different targets, so
      // its content on disk is unknown; write once instead of comparing.
      if (!(await writePlan(index, content, description))) {
        await markFailed(index, content, description);
      }
      continue;
    }

    if (await writePlan(index, content, description)) {
      availablePlans.add(index);
      updatedDocs.push({ ...markdownDoc, content, description });
      logger.verbose(`Generated markdown file: ${planned.filePath}`);
    } else {
      await markFailed(index, content, description);
    }
  }

  while (failedPlans.size > 0) {
    let failedDuringPass = false;
    const targets = new Map(registry.markdownUrls);
    for (const planned of plannedDocs) targets.delete(planned.doc.path);
    for (const index of availablePlans) {
      const planned = plannedDocs[index];
      targets.set(
        planned.doc.path,
        toMarkdownDocInfo(planned.doc, siteUrl, planned.versionPath, planned.filePath).url,
      );
    }
    for (const index of failedPlans) {
      const planned = plannedDocs[index];
      if (!targets.has(planned.doc.path)) targets.set(planned.doc.path, planned.doc.url);
    }

    for (let index = 0; index < plannedDocs.length; index++) {
      const planned = plannedDocs[index];
      const { doc } = planned;
      const available = availablePlans.has(index);
      const baseDoc = available
        ? toMarkdownDocInfo(doc, siteUrl, planned.versionPath, planned.filePath)
        : doc;
      const { content, description } = rewritePlan(doc, targets);
      updatedDocs[index] = {
        ...baseDoc,
        content,
        description,
        ...(available ? {} : { markdownFile: false }),
      };

      if (
        available &&
        !skippedPlans.has(index) &&
        (renderedContents.get(index) !== content || renderedDescriptions.get(index) !== description)
      ) {
        if (!(await writePlan(index, content, description))) {
          await markFailed(index, content, description);
          failedDuringPass = true;
        }
      }
    }

    if (!failedDuringPass) break;
  }

  // Keep the cross-pass registry on the files that actually exist. Duplicate
  // source paths use their last available assignment, matching path planning.
  for (const planned of plannedDocs) {
    registry.docPaths.delete(planned.doc.path);
    registry.markdownUrls.delete(planned.doc.path);
  }
  for (const index of availablePlans) {
    const planned = plannedDocs[index];
    registry.docPaths.set(planned.doc.path, planned.filePath);
    registry.markdownUrls.set(
      planned.doc.path,
      toMarkdownDocInfo(planned.doc, siteUrl, planned.versionPath, planned.filePath).url,
    );
  }

  return updatedDocs;
}

/**
 * Create updated DocInfo with a new URL pointing to its generated markdown file
 * @param doc - The source document
 * @param siteUrl - Base site URL
 * @param versionPath - The version's path prefix, prepended to the link
 * @param filePath - The markdown file's path relative to the version's output directory
 */
function toMarkdownDocInfo(
  doc: DocInfo,
  siteUrl: string,
  versionPath: string,
  filePath: string,
): DocInfo {
  // Convert file path to URL path (use forward slashes)
  const urlPath = normalizePath(filePath);
  // filePath is relative to the baseUrl, which is always prepended (its first
  // segment can equal the baseUrl), and holds decoded names that are encoded
  // for the link.
  const relativeUrl = encodeUrlPathSegments(versionPath ? `${versionPath}/${urlPath}` : urlPath);
  return {
    ...doc,
    url: joinSiteRelativeUrl(siteUrl, relativeUrl),
    path: `/${urlPath}`, // Update path to the new markdown file
    markdownFile: true,
  };
}

/**
 * Resolve an output file under a version's directory, or return undefined
 * (with a warning) when it would land outside the build directory.
 * @param outDir - The build output directory every file must stay inside
 * @param versionedOutDir - The version's output directory
 * @param filename - The configured output filename
 */
function resolveOutputFile(
  outDir: string,
  versionedOutDir: string,
  filename: string,
): string | undefined {
  const filePath = path.join(versionedOutDir, filename);
  if (isPathInside(outDir, filePath)) return filePath;
  logger.warn(`Skipping ${filename}: ${filePath} is outside the build directory ${outDir}`);
  return undefined;
}

/**
 * Generate the LLM outputs for one version: the individual markdown files,
 * llms.txt, llms-full.txt, and the configured custom files.
 *
 * Every selection is processed before the first file is written, so a link in
 * any output resolves to the generated markdown of a page another selection
 * contributes, and every output reflects which markdown files exist.
 *
 * @param context - Plugin context
 * @param allDocFiles - Array of all document files
 * @param listUnversionedDocs - Whether the files list pages no version owns (blog posts); only the version that owns the standard files passes true
 */
export async function generateLLMFiles(
  context: PluginContext,
  allDocFiles: string[],
  listUnversionedDocs: boolean = true,
): Promise<void> {
  const { outDir, siteUrl, docTitle, docDescription, options } = context;
  // Version-scoped output lands under a subdirectory of outDir (e.g. 'stable').
  const versionedOutDir = path.join(outDir, context.outputSubdir || '');

  const {
    generateLLMsTxt,
    generateLLMsFullTxt,
    llmsTxtFilename = 'llms.txt',
    llmsFullTxtFilename = 'llms-full.txt',
    includeOrder = [],
    includeUnmatchedLast = true,
    version,
    generateMarkdownFiles = false,
    rootContent,
    fullRootContent,
    processingBatchSize = 100,
    addMdExtension = true,
    useRelativeUrls = false,
    customLLMFiles = [],
    ignoreFiles = [],
  } = options;

  if (context.outputSubdir && !isPathInside(outDir, versionedOutDir)) {
    logger.warn(`Version output directory ${versionedOutDir} is outside ${outDir}. Skipping.`);
    return;
  }

  // Standard selection: the pages llms.txt and llms-full.txt list.
  let standardDocs: DocInfo[] | undefined;
  if (!generateLLMsTxt && !generateLLMsFullTxt) {
    logger.warn('No standard LLM files configured for generation. Skipping.');
  } else {
    const processedDocs = await processFilesWithPatterns(
      context,
      allDocFiles,
      [], // No specific include patterns - include all
      [], // No additional ignore patterns beyond global ignoreFiles
      includeOrder,
      includeUnmatchedLast,
    );

    // Blog posts are the same content in every version, so only the version
    // that owns the standard files lists them; the others leave them to their
    // custom LLM files.
    const listedDocs = listUnversionedDocs
      ? processedDocs
      : processedDocs.filter((doc) => !doc.unversioned);
    logger.verbose(`Processed ${listedDocs.length} documentation files for standard LLM files`);

    if (isNonEmptyArray(listedDocs)) {
      standardDocs = listedDocs;
    } else {
      logger.warn('No documents found matching patterns for standard LLM files. Skipping.');
    }
  }

  // Custom selections: every configured file resolves its pages before any
  // output is written.
  const pendingFiles: Array<{
    customFile: CustomLLMFile;
    customFilePath: string;
    docs: DocInfo[];
  }> = [];
  if (customLLMFiles.length === 0) {
    logger.warn('No custom LLM files configured. Skipping.');
  } else {
    logger.info(`Generating ${customLLMFiles.length} custom LLM files...`);
    for (const customFile of customLLMFiles) {
      logger.verbose(
        `Processing custom file: ${customFile.filename}, version: ${customFile.version || 'undefined'}`,
      );

      const customFilePath = resolveOutputFile(outDir, versionedOutDir, customFile.filename);
      if (!customFilePath) continue;

      const combinedIgnores = [...ignoreFiles];
      if (customFile.ignorePatterns) {
        combinedIgnores.push(...customFile.ignorePatterns);
      }
      const customDocs = await processFilesWithPatterns(
        context,
        allDocFiles,
        customFile.includePatterns,
        combinedIgnores,
        customFile.orderPatterns || [],
        customFile.includeUnmatchedLast ?? true,
      );

      if (customDocs.length === 0) {
        logger.warn(`No matching documents found for custom LLM file: ${customFile.filename}`);
      } else {
        pendingFiles.push({ customFile, customFilePath, docs: customDocs });
      }
    }
  }

  // One markdown pass over every selected page, so a page in one selection can
  // link to a page another one contributes and the outputs below know which
  // generated files exist.
  const unionBySource = new Map<string, DocInfo>();
  for (const doc of standardDocs ?? []) {
    if (!unionBySource.has(doc.path)) unionBySource.set(doc.path, doc);
  }
  for (const pending of pendingFiles) {
    for (const doc of pending.docs) {
      if (!unionBySource.has(doc.path)) unionBySource.set(doc.path, doc);
    }
  }
  const unionDocs = [...unionBySource.values()];

  const generatedBySource = new Map<string, DocInfo>();
  if (generateMarkdownFiles && unionDocs.length > 0) {
    logger.info('Generating individual markdown files...');
    const generatedDocs = await generateIndividualMarkdownFiles(
      unionDocs,
      versionedOutDir,
      siteUrl,
      context.docsDir,
      context.options.keepFrontMatter || [],
      context.options.preserveDirectoryStructure !== false, // Default to true
      context.docsSections,
      context.outputSubdir || '',
      context.markdownPaths,
      outDir,
      useRelativeUrls,
    );
    for (const [index, doc] of unionDocs.entries()) {
      const generated = generatedDocs[index];
      if (generated) generatedBySource.set(doc.path, generated);
    }
  }
  const resolveDoc = (doc: DocInfo): DocInfo => generatedBySource.get(doc.path) ?? doc;

  // Only append `.md` to links when the individual markdown files are actually
  // generated — otherwise the links point to files that don't exist and 404
  // (issue #41). When generateMarkdownFiles is off, link to the normal routes.
  const emitMdLinks = addMdExtension && generateMarkdownFiles;

  if (standardDocs) {
    const listedDocs = standardDocs.map(resolveDoc);
    const llmsTxtPath = generateLLMsTxt
      ? resolveOutputFile(outDir, versionedOutDir, llmsTxtFilename)
      : undefined;
    if (llmsTxtPath) {
      await generateLLMFile(
        listedDocs,
        llmsTxtPath,
        docTitle,
        docDescription,
        false, // links only
        version,
        rootContent,
        processingBatchSize,
        emitMdLinks,
        useRelativeUrls,
      );
    }

    const llmsFullTxtPath = generateLLMsFullTxt
      ? resolveOutputFile(outDir, versionedOutDir, llmsFullTxtFilename)
      : undefined;
    if (llmsFullTxtPath) {
      await generateLLMFile(
        listedDocs,
        llmsFullTxtPath,
        docTitle,
        docDescription,
        true, // full content
        version,
        fullRootContent,
        processingBatchSize,
        emitMdLinks,
        useRelativeUrls,
      );
    }
  }

  for (const pending of pendingFiles) {
    const customDocs = pending.docs.map(resolveDoc);
    await generateLLMFile(
      customDocs,
      pending.customFilePath,
      pending.customFile.title || docTitle,
      pending.customFile.description || docDescription,
      pending.customFile.fullContent,
      pending.customFile.version ?? version,
      pending.customFile.rootContent,
      processingBatchSize,
      emitMdLinks,
      useRelativeUrls,
    );
    logger.info(
      `Generated custom LLM file: ${pending.customFile.filename} with ${customDocs.length} documents`,
    );
  }
}

/**
 * Collect all document files from docs directory and optionally blog
 * @param context - Plugin context
 * @returns Array of file paths
 */
export async function collectDocFiles(context: PluginContext): Promise<string[]> {
  const { siteDir, options, docsSections } = context;
  const {
    ignoreFiles = [],
    includeBlog = false,
    blogDir: blogDirOption = 'blog',
    warnOnIgnoredFiles = false,
  } = options;

  const allDocFiles: string[] = [];

  // Process each docs section
  for (const section of docsSections) {
    const fullDocsDir = path.join(siteDir, section.path);

    try {
      await fs.access(fullDocsDir);

      // Collect all markdown files from this section's directory
      const docFiles = await readMarkdownFiles(
        fullDocsDir,
        siteDir,
        ignoreFiles,
        section.path,
        warnOnIgnoredFiles,
      );
      allDocFiles.push(...docFiles);
    } catch {
      logger.warn(`Docs directory not found: ${fullDocsDir}`);
    }
  }

  // Process blog if enabled
  if (includeBlog) {
    const blogDir = path.join(siteDir, blogDirOption);

    try {
      await fs.access(blogDir);

      // Collect all markdown files from blog directory
      const blogFiles = await readMarkdownFiles(
        blogDir,
        siteDir,
        ignoreFiles,
        blogDirOption,
        warnOnIgnoredFiles,
      );
      allDocFiles.push(...blogFiles);
    } catch {
      logger.warn(`Blog directory not found: ${blogDir}`);
    }
  }

  return allDocFiles;
}
