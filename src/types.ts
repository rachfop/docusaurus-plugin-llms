/**
 * Type definitions for the docusaurus-plugin-llms plugin
 */

/**
 * Interface for a documentation section (used when docsDir is an array)
 */
export interface DocsSection {
  /** Filesystem path relative to siteDir (e.g., 'docs', 'api') */
  path: string;
  /** Docusaurus routeBasePath for this section (e.g., 'docs', 'api') */
  routeBasePath: string;
  /** Optional human-readable label shown as a section heading in llms.txt */
  label?: string;
}

/**
 * Interface for processed document information
 */
export interface DocInfo {
  title: string;
  path: string;
  url: string;
  content: string;
  description: string;
  frontMatter?: Record<string, any>;
  /** Section label assigned when multiple docsDir sections are configured */
  section?: string;
}

/**
 * Interface for custom LLM file configuration
 */
export interface CustomLLMFile {
  /** Name of the output file (e.g., 'llms-python.txt') */
  filename: string;
  
  /** Glob patterns for files to include */
  includePatterns: string[];
  
  /** Whether to include full content (true) or just links (false) */
  fullContent: boolean;
  
  /** Custom title for this file (defaults to site title) */
  title?: string;
  
  /** Custom description for this file (defaults to site description) */
  description?: string;
  
  /** Additional patterns to exclude (combined with global ignoreFiles) */
  ignorePatterns?: string[];
  
  /** Order patterns for controlling file ordering (similar to includeOrder) */
  orderPatterns?: string[];
  
  /** Whether to include unmatched files last (default: false) */
  includeUnmatchedLast?: boolean;
  
  /** Version information for this LLM file */
  version?: string;
  
  /** Custom content to include at the root level (after title/description) */
  rootContent?: string;
}

/**
 * Configuration for a single documentation version.
 *
 * When `versions` is set, the plugin runs its full generation pipeline once per
 * version, writing each version's files under its own `path` subdirectory and
 * resolving links against that version's routes. Any field left unset falls back
 * to the corresponding top-level plugin option.
 */
export interface VersionConfig {
  /** Version identifier (e.g. 'nightly', 'stable', 'main', '0.0.1'). */
  name: string;
  /** Human-readable label for the `Version:` metadata line (defaults to `name`). */
  label?: string;
  /**
   * Source docs directory (or sections) for this version, relative to siteDir
   * (e.g. 'docs' for the current version, 'versioned_docs/version-1' for a
   * versioned one). Defaults to the top-level `docsDir`.
   */
  docsDir?: string | DocsSection[];
  /**
   * Output subdirectory and route prefix for this version (e.g. '' for the site
   * root, 'stable', '0.0.1'). Files are written to `<outDir>/<path>/` and links
   * resolve to routes under `/<path>/`. Defaults to `name`.
   */
  path?: string;
  /** Per-version custom LLM files (defaults to the top-level `customLLMFiles`). */
  customLLMFiles?: CustomLLMFile[];
  /** Per-version include order (defaults to the top-level `includeOrder`). */
  includeOrder?: string[];
}

/**
 * Plugin options interface
 */
export interface PluginOptions {
  /** Whether to generate the llms.txt file (default: true) */
  generateLLMsTxt?: boolean;
  
  /** Whether to generate the llms-full.txt file (default: true) */
  generateLLMsFullTxt?: boolean;
  
  /** Base directory for documentation files (default: 'docs'), or an array of section objects */
  docsDir?: string | DocsSection[];
  
  /** Array of glob patterns for files to ignore */
  ignoreFiles?: string[];
  
  /** Custom title to use in generated files (defaults to site title) */
  title?: string;
  
  /** Custom description to use in generated files (defaults to site tagline) */
  description?: string;
  
  /** Custom file name for the links file (default: 'llms.txt') */
  llmsTxtFilename?: string;
  
  /** Custom file name for the full content file (default: 'llms-full.txt') */
  llmsFullTxtFilename?: string;
  
  /** Whether to include blog content (default: false) */
  includeBlog?: boolean;
  
  /** Path transformation options for URL construction */
  pathTransformation?: {
    /** Path segments to ignore when constructing URLs (will be removed if found) */
    ignorePaths?: string[];
    /** Path segments to add when constructing URLs (will be prepended if not already present) */
    addPaths?: string[];
  };

  /** Array of glob patterns for controlling the order of files (files will be processed in the order of patterns) */
  includeOrder?: string[];
  
  /** Whether to include files that don't match any pattern in includeOrder at the end (default: true) */
  includeUnmatchedLast?: boolean;
  
  /** Array of custom LLM file configurations */
  customLLMFiles?: CustomLLMFile[];
  
  /** Global version for all generated LLM files */
  version?: string;
  
  /** Whether to exclude import statements from the generated content (default: false) */
  excludeImports?: boolean;
  
  /** Whether to remove redundant content that duplicates heading text (default: false) */
  removeDuplicateHeadings?: boolean;
  
  /** Whether to generate individual markdown files and link to them from llms.txt instead of original docs (default: false) */
  generateMarkdownFiles?: boolean;

  /** Array of frontmatter keys to preserve in generated individual markdown files (only used when generateMarkdownFiles is true) */
  keepFrontMatter?: string[];

  /** Custom content to include at the root level of llms.txt (after title/description, before TOC) */
  rootContent?: string;
  
  /** Custom content to include at the root level of llms-full.txt (after title/description, before content sections) */
  fullRootContent?: string;

  /** Whether to preserve directory structure in generated markdown files (default: true) */
  preserveDirectoryStructure?: boolean;

  /** Batch size for processing large document sets to prevent memory issues (default: 100) */
  processingBatchSize?: number;

  /** Whether to append .md to link URLs in llms.txt per the llmstxt.org spec (default: true) */
  addMdExtension?: boolean;

  /** Logging level for plugin output (default: 'normal'). Options: 'quiet', 'normal', 'verbose' */
  logLevel?: 'quiet' | 'normal' | 'verbose';

  /** Whether to warn about files that are ignored (no extension or unsupported extension) (default: false) */
  warnOnIgnoredFiles?: boolean;

  /** Whether to rewrite relative image URLs to absolute URLs in generated content (default: false).
   *  When enabled, references like `./img/foo.png` are resolved to their hashed build output URL
   *  (e.g., `https://site.com/assets/images/foo-abc123.png`) so LLMs can access the images. */
  rewriteImageUrls?: boolean;

  /** Whether to emit origin-relative URLs instead of absolute ones (default: false).
   *  When enabled, links in `llms.txt` use the path only — including the site's
   *  baseUrl — e.g. `/docs/page.md` instead of `https://site.com/docs/page.md`.
   *  Useful when the site can't pin a stable `url` (e.g. subpath deployments). */
  useRelativeUrls?: boolean;

  /**
   * Generate version-scoped LLM files. Provide an explicit array of versions, or
   * `'auto'` to detect them from Docusaurus docs versioning (versions.json +
   * versioned_docs/). Omit for the default single-root behavior.
   */
  versions?: VersionConfig[] | 'auto';

  /** Index signature for Docusaurus plugin compatibility */
  [key: string]: unknown;
}

/**
 * Plugin context with processed options
 */
export interface PluginContext {
  siteDir: string;
  outDir: string;
  siteUrl: string;
  docsDir: string;
  docTitle: string;
  docDescription: string;
  options: PluginOptions;
  routesPaths?: string[];
  /** Pre-built lookup map: image basename → hashed asset paths relative to outDir.
   *  Built once per postBuild run when rewriteImageUrls is true. */
  imageAssetMap?: Map<string, string[]>;
  docsSections: DocsSection[];
  /**
   * Output subdirectory (relative to outDir) for the version being generated.
   * Empty/undefined writes to the site root (the default).
   */
  outputSubdir?: string;
  /**
   * Route prefix (e.g. '/stable') the current version's URLs must fall under.
   * Empty/undefined means the root version.
   */
  routePrefix?: string;
  /**
   * Route prefixes owned by other versions. When resolving the root version's
   * URLs, routes under these prefixes are excluded so links stay at the root.
   */
  siblingPrefixes?: string[];
}