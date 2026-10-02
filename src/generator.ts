/**
 * LLM file generation functions for the docusaurus-plugin-llms plugin
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { DocInfo, DocsSection, MarkdownPathRegistry, PluginContext } from './types';
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
  joinSiteUrl,
  getSiteBasePath,
  stripSiteBasePath,
  stripNumberPrefix,
  isPathInside,
} from './utils';
import { processFilesWithPatterns } from './processor';
import {
  demoteHeadings,
  stripDuplicateTitleHeading,
  stripDuplicateDescriptionParagraph,
} from './content';

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

  // Truncate if too long (150 characters max with ellipsis)
  if (cleaned.length <= 150) return cleaned;
  let truncated = cleaned.substring(0, 147);
  // A cut inside a code span or link would leave it open and break the TOC
  // line's markdown, so cut before the unclosed opener instead.
  if ((truncated.match(/`/g) || []).length % 2 === 1) {
    truncated = truncated.substring(0, truncated.lastIndexOf('`')).trimEnd();
  }
  const openLink = truncated.search(/!?\[[^\]]*$|!?\[[^\]]*\]\([^)]*$/);
  if (openLink !== -1) {
    truncated = truncated.substring(0, openLink).trimEnd();
  }
  return `${truncated}...`;
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
      let linkUrl = addMdExtension ? applyMdExtension(doc.url) : doc.url;
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
  registry: MarkdownPathRegistry = { usedPaths: new Set(), docPaths: new Map() },
): Promise<DocInfo[]> {
  const updatedDocs: DocInfo[] = [];
  const { usedPaths } = registry;
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
    // A doc an earlier pass already wrote keeps that file, so the standard and
    // custom outputs link to the same page and neither overwrites the other.
    const assignedPath = earlierDocPaths.get(doc.path);
    if (assignedPath !== undefined) {
      updatedDocs.push(toMarkdownDocInfo(doc, siteUrl, versionPath, assignedPath));
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
        const route = new URL(doc.url).pathname.replace(/\/+$/, '') || '/';
        let urlPathname = stripSiteBasePath(route, siteBasePath).replace(/^\/+/, '');

        // A version's routes carry its path ('stable/get-started'), but
        // outputDir is already that version's subdirectory.
        if (versionPath) {
          if (urlPathname === versionPath) {
            urlPathname = '';
          } else if (urlPathname.startsWith(`${versionPath}/`)) {
            urlPathname = urlPathname.slice(versionPath.length + 1);
          }
        }

        if (urlPathname === '') {
          // Root page (slug: /) → serve as index.md
          relativePath = 'index.md';
        } else {
          // Strip any residual numeric ordering prefixes from each segment.
          // Docusaurus already strips them in resolved URLs, but fallback URLs
          // constructed from the source file path may still contain them.
          let cleanPathname = urlPathname
            .split('/')
            .map(stripNumberPrefix)
            .join('/')
            // Strip an existing markdown extension so we don't produce
            // double extensions like "config.md.md" when doc.url already
            // ends in .md/.mdx (e.g. in tests or external usage).
            .replace(/\.mdx?$/i, '');

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

    // An explicit frontmatter slug (or id, the next-best authority) wins over
    // the path derived from the resolved URL: it declares the page's real route
    // even when route resolution failed and doc.url was unavailable.
    const frontMatterOverride = isNonEmptyString(doc.frontMatter?.slug)
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
    } else if (!isPathInside(outputDir, relativePath)) {
      logger.warn(
        `Markdown path ${relativePath} for ${doc.path} is outside ${outputDir}; using ${sanitizedTitle}.md`,
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
    let fullPath = path.join(outputDir, uniquePath);
    fullPath = shortenPathIfNeeded(fullPath, outputDir, uniquePath);

    // Update uniquePath to reflect the shortened path if it was changed
    if (fullPath !== path.join(outputDir, uniquePath)) {
      uniquePath = path.relative(outputDir, fullPath);
    }
    registry.docPaths.set(doc.path, uniquePath);

    const directory = path.dirname(fullPath);

    // Create directory structure if it doesn't exist
    try {
      await fs.mkdir(directory, { recursive: true });
    } catch (error: unknown) {
      throw new Error(`Failed to create directory ${directory}: ${getErrorMessage(error)}`);
    }

    // Extract preserved frontmatter if specified
    let preservedFrontMatter: Record<string, any> = {};
    if (isNonEmptyArray(keepFrontMatter) && isDefined(doc.frontMatter)) {
      for (const key of keepFrontMatter) {
        if (key in doc.frontMatter) {
          preservedFrontMatter[key] = doc.frontMatter[key];
        }
      }
    }

    // The file header already emits `# {title}` and the description blockquote,
    // so strip the body's own identical H1 and its identical first paragraph
    // (docs without frontmatter get their intro paragraph extracted as the
    // description); leaving either in would duplicate content the header just
    // provided. The paragraph strip is an exact-match removal, so it is safe
    // at any description length.
    let bodyContent = stripDuplicateTitleHeading(doc.content, doc.title);
    if (isNonEmptyString(doc.description)) {
      bodyContent = stripDuplicateDescriptionParagraph(bodyContent, doc.description);
    }

    // Create markdown content using the utility function
    const markdownContent = createMarkdownContent(
      doc.title,
      doc.description,
      bodyContent,
      true, // includeMetadata
      Object.keys(preservedFrontMatter).length > 0 ? preservedFrontMatter : undefined,
    );

    // Write the markdown file
    try {
      await writeFile(fullPath, markdownContent);
    } catch (error: unknown) {
      throw new Error(`Failed to write file ${fullPath}: ${getErrorMessage(error)}`);
    }

    updatedDocs.push(toMarkdownDocInfo(doc, siteUrl, versionPath, uniquePath));

    logger.verbose(`Generated markdown file: ${uniquePath}`);
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
  return {
    ...doc,
    url: joinSiteUrl(siteUrl, versionPath ? `${versionPath}/${urlPath}` : urlPath),
    path: `/${urlPath}`, // Update path to the new markdown file
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
 * Generate standard LLM files (llms.txt and llms-full.txt)
 * @param context - Plugin context
 * @param allDocFiles - Array of all document files
 */
export async function generateStandardLLMFiles(
  context: PluginContext,
  allDocFiles: string[],
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
  } = options;

  if (!generateLLMsTxt && !generateLLMsFullTxt) {
    logger.warn('No standard LLM files configured for generation. Skipping.');
    return;
  }

  if (context.outputSubdir && !isPathInside(outDir, versionedOutDir)) {
    logger.warn(`Version output directory ${versionedOutDir} is outside ${outDir}. Skipping.`);
    return;
  }

  // Process files for the standard outputs
  let processedDocs = await processFilesWithPatterns(
    context,
    allDocFiles,
    [], // No specific include patterns - include all
    [], // No additional ignore patterns beyond global ignoreFiles
    includeOrder,
    includeUnmatchedLast,
  );

  logger.verbose(`Processed ${processedDocs.length} documentation files for standard LLM files`);

  // Check if we have documents to process
  if (!isNonEmptyArray(processedDocs)) {
    logger.warn('No documents found matching patterns for standard LLM files. Skipping.');
    return;
  }

  // Generate individual markdown files if requested
  if (generateMarkdownFiles) {
    logger.info('Generating individual markdown files...');
    processedDocs = await generateIndividualMarkdownFiles(
      processedDocs,
      versionedOutDir,
      siteUrl,
      context.docsDir,
      context.options.keepFrontMatter || [],
      context.options.preserveDirectoryStructure !== false, // Default to true
      context.docsSections,
      context.outputSubdir || '',
      context.markdownPaths,
    );
  }

  // Only append `.md` to links when the individual markdown files are actually
  // generated — otherwise the links point to files that don't exist and 404
  // (issue #41). When generateMarkdownFiles is off, link to the normal routes.
  const emitMdLinks = addMdExtension && generateMarkdownFiles;

  // Generate llms.txt
  const llmsTxtPath = generateLLMsTxt
    ? resolveOutputFile(outDir, versionedOutDir, llmsTxtFilename)
    : undefined;
  if (llmsTxtPath) {
    await generateLLMFile(
      processedDocs,
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

  // Generate llms-full.txt
  const llmsFullTxtPath = generateLLMsFullTxt
    ? resolveOutputFile(outDir, versionedOutDir, llmsFullTxtFilename)
    : undefined;
  if (llmsFullTxtPath) {
    await generateLLMFile(
      processedDocs,
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

/**
 * Generate custom LLM files based on configuration
 * @param context - Plugin context
 * @param allDocFiles - Array of all document files
 */
export async function generateCustomLLMFiles(
  context: PluginContext,
  allDocFiles: string[],
): Promise<void> {
  const { outDir, siteUrl, docTitle, docDescription, options } = context;
  const versionedOutDir = path.join(outDir, context.outputSubdir || '');
  const {
    customLLMFiles = [],
    ignoreFiles = [],
    generateMarkdownFiles = false,
    processingBatchSize = 100,
    addMdExtension = true,
    useRelativeUrls = false,
  } = options;

  if (customLLMFiles.length === 0) {
    logger.warn('No custom LLM files configured. Skipping.');
    return;
  }

  if (context.outputSubdir && !isPathInside(outDir, versionedOutDir)) {
    logger.warn(`Version output directory ${versionedOutDir} is outside ${outDir}. Skipping.`);
    return;
  }

  logger.info(`Generating ${customLLMFiles.length} custom LLM files...`);

  for (const customFile of customLLMFiles) {
    logger.verbose(
      `Processing custom file: ${customFile.filename}, version: ${customFile.version || 'undefined'}`,
    );

    const customFilePath = resolveOutputFile(outDir, versionedOutDir, customFile.filename);
    if (!customFilePath) continue;

    // Combine global ignores with custom ignores
    const combinedIgnores = [...ignoreFiles];
    if (customFile.ignorePatterns) {
      combinedIgnores.push(...customFile.ignorePatterns);
    }

    // Process files according to the custom configuration
    let customDocs = await processFilesWithPatterns(
      context,
      allDocFiles,
      customFile.includePatterns,
      combinedIgnores,
      customFile.orderPatterns || [],
      customFile.includeUnmatchedLast ?? true,
    );

    if (customDocs.length > 0) {
      // Generate individual markdown files if requested
      if (generateMarkdownFiles) {
        logger.info(
          `Generating individual markdown files for custom file: ${customFile.filename}...`,
        );
        customDocs = await generateIndividualMarkdownFiles(
          customDocs,
          versionedOutDir,
          siteUrl,
          context.docsDir,
          context.options.keepFrontMatter || [],
          context.options.preserveDirectoryStructure !== false, // Default to true
          context.docsSections,
          context.outputSubdir || '',
          context.markdownPaths,
        );
      }

      // Use custom title/description or fall back to defaults
      const customTitle = customFile.title || docTitle;
      const customDescription = customFile.description || docDescription;

      // Only append `.md` to links when the markdown files are actually
      // generated, so links never point to nonexistent files (issue #41).
      const emitMdLinks = addMdExtension && generateMarkdownFiles;

      // Per-file `version` wins; otherwise a custom file inherits the current
      // version's label so version-scoped outputs (stable/llms-python.txt) are
      // labeled like their llms.txt.
      await generateLLMFile(
        customDocs,
        customFilePath,
        customTitle,
        customDescription,
        customFile.fullContent,
        customFile.version ?? options.version,
        customFile.rootContent,
        processingBatchSize,
        emitMdLinks,
        useRelativeUrls,
      );

      logger.info(
        `Generated custom LLM file: ${customFile.filename} with ${customDocs.length} documents`,
      );
    } else {
      logger.warn(`No matching documents found for custom LLM file: ${customFile.filename}`);
    }
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
