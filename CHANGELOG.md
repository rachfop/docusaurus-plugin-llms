# Changelog

All notable changes to the docusaurus-plugin-llms will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **`INDEX.md` and `README.md` linked to pages that don't exist** (#74):
  URL resolution recognized only a lowercase `index`, so `INDEX.md`,
  `Index.md`, and `README.md` got a file-name URL that 404s. They now resolve
  to their directory's route, following Docusaurus's own convention.
- **Descriptions picked up code fences, tables, and JSX** (#76): with no
  frontmatter `description`, the first block under the H1 became the page
  description even when it was a code fence, `:::note` admonition, table,
  JSX/HTML element, HTML comment, or standalone image. Description extraction
  now skips those blocks and masks code fences, so a fence containing a blank
  line no longer splits into fragments.
- **Multi-section sites linked to file-name URLs** (#77): on unversioned
  sites, a section whose `routeBasePath` isn't `/` matched no routes, so its
  docs fell back to URLs like `/other/README`. Route scoping also ignored the
  site `baseUrl`. `routeBasePath`, version `path`, and `blogRouteBasePath` are
  now matched relative to `baseUrl`.
- **`logLevel: 'quiet'` printed normal output**: the level map fell back to
  `normal` with `||`, and `LogLevel.QUIET` is `0`. Quiet mode now prints errors
  only.
- **`processingBatchSize` of `0` or less hung the build**: the batch loop
  never advanced. The option must now be a positive integer, and other values
  fail option validation.
- **A frontmatter `slug` could write files outside the build directory**: with
  `generateMarkdownFiles`, a slug such as `../../../escaped` wrote its markdown
  file above `outDir`. Markdown paths now drop `.` and `..` segments, and any
  path that still resolves outside the output directory falls back to a
  filename from the page title.
- **Output filenames and version paths could escape the build directory**:
  `customLLMFiles[].filename`, `llmsTxtFilename`, `llmsFullTxtFilename`, and
  `versions[].path` accepted absolute paths and `..` segments. Option
  validation now rejects them, and a write-time check skips any file outside
  `outDir`.
- **Generated files with the same name overwrote each other**: an
  `llmsTxtFilename` equal to `llmsFullTxtFilename`, or a custom filename equal
  to a standard output or another custom file, silently replaced one file with
  another. Option validation now rejects these collisions, counting only the
  files that are generated.
- **Custom LLM files overwrote markdown files from `llms.txt`**: with
  `generateMarkdownFiles`, each custom file assigned markdown paths from
  scratch, so a page could overwrite another page's file (for example two
  sections' `intro.md` with `preserveDirectoryStructure: false`), leaving an
  `llms.txt` link serving the wrong page. Each version now assigns every doc
  one markdown file, shared by `llms.txt`, `llms-full.txt`, and custom files.
- **Versioned markdown files repeated the version path**: with `versions` and
  `generateMarkdownFiles`, a page at `/stable/get-started` was written to
  `build/stable/stable/get-started.md` while `stable/llms.txt` linked
  `/stable/get-started.md`. Files now land at the linked path.
- **Prose lines starting with "import" were deleted**: inlined partials, and
  pages built with `excludeImports`, lost any line beginning with `import `,
  so prose wrapped onto a line starting "import the SDK ..." dropped that
  line. A multi-line `import { ... } from '...'` was half-removed. Only ES
  import statements with a quoted module specifier are removed now,
  multi-line ones whole.
- **Code samples in nested partials were emptied or spliced**: imports and
  partial usage inside a nested partial's code fence were resolved as real,
  and one partial's body could be spliced into another partial's code sample
  (`<B />` in a fence in partial A). Code is masked at every resolution level,
  and inlined partial bodies are protected from later splices.
- **Long JSX tags hung the build**: a tag with many brace-valued attributes
  and one deeply nested expression backtracked exponentially (seconds at 24
  attributes, longer beyond). The attribute matcher has one way to match each
  value and finishes in linear time.
- **HTML tags were removed with no separator**: `a<br/>b` became `ab`, table
  cells ran together, and `<img>` disappeared. Block tags (`br`, `p`, `div`,
  `li`, `tr`, ...) now leave a line break, adjacent cells are separated by a
  pipe (`a | b`), and `<img src alt>` becomes `![alt](src)`, so image-URL
  rewriting applies to it.
- **Nested and blockquoted fences were not masked**: a ```` fence showing a
  ``` fence closed at the inner fence, and fences inside `>` blockquotes were
  not masked, so HTML in those samples was stripped. Closing fences follow
  CommonMark (same character, at least as long as the opener), and
  blockquoted fences are masked.
- **Descriptions came from code comments and MDX comments**: the H1 fallback
  read `# install deps` from a bash fence, and a `{/* TODO */}` paragraph
  became the description. Both are skipped, and MDX `{/* */}` and HTML
  `<!-- -->` comments outside code are stripped from the output.
- **Some partial imports and usages were not inlined**: the
  `import { default as X } from './_x.mdx'` and
  `import Y, { toc } from './_y.mdx'` forms lost the partial body and leaked
  the import line, and a partial used with element children
  (`<P><b>x</b></P>`) was not replaced.
- **`preserveComponents` couldn't keep `<Table>`-style components or
  `<TabItem>`**: HTML tag stripping matched names case-insensitively, so a
  component such as `<Table>` or `<B>` was stripped as HTML, and `<TabItem>`
  became a label line before the preserve check ran, leaving an unbalanced
  `</TabItem>`. HTML stripping matches lowercase element names only, and a
  preserved `TabItem` keeps its tag.
- **Tab labels read the wrong attribute or kept quotes**: `data-label="x"`
  was read as `label`, and `label={"Python"}` produced `**"Python"**`. The
  attribute name must follow whitespace, and a brace expression holding a
  single string or template literal yields the literal's text.
- **Page titles could break llms.txt links and headings**: a title containing
  `]`, `[`, or `\` ended or nested the link text, and a multi-line title split
  the TOC line and the `## ` / `# ` heading. Titles are collapsed to one line,
  and link text escapes `\`, `[`, and `]`.
- **TOC descriptions stopped at the first line break**: with no frontmatter
  `description`, a hard-wrapped first paragraph was cut at its first line.
  The paragraph's lines are joined before the 150-character truncation.
  Whitespace runs in every TOC description collapse to one space.
- **Blog posts were listed under the last docs section's heading**: with
  several `docsDir` sections and `includeBlog`, blog links followed the last
  section's links in llms.txt. They're grouped under a `## Blog` heading.
- **`useRelativeUrls`, `rewriteImageUrls`, and `warnOnIgnoredFiles` accepted
  any value**: `useRelativeUrls: 'false'` passed validation and enabled the
  option. These options must be booleans.
- **`logLevel` leaked between plugin instances**: the level was module-wide,
  so with two instances the last one constructed set the level for both
  (a `quiet` instance printed output). Each instance's `postBuild` logs at its
  own level, including when Docusaurus runs the instances concurrently.
- **Duplicate llms-full.txt headings had no space before the suffix**: a
  repeated title became `## Guide(Install)` or `## Intro(3)`. The suffix
  follows a space: `## Guide (Install)`, `## Intro (3)`. This changes the
  llms-full.txt headings of sites with duplicate page titles.
- **`rewriteImageUrls` skipped some relative image paths**: `![a](img/x.png)`
  (no `./`), `![a](<./my img.png>)`, and `![a](./my%20img.png)` kept their
  source paths. Markdown image paths that aren't absolute, root-relative, or
  aliases are rewritten, percent-decoded for the asset lookup as Docusaurus
  does, and spaces in the asset URL are percent-encoded.

### Documentation

- Corrected option behavior in the docs: `addMdExtension` applies only with
  `generateMarkdownFiles`, `customLLMFiles[].includeUnmatchedLast` defaults to
  `true`, any `.md`/`.mdx` import is inlined, and `processingBatchSize` sets
  how often verbose mode logs progress.
- Documented how page titles and descriptions are chosen, directory index
  handling, and the `llms-full.txt` page structure.
- **Blank lines inside code samples were collapsed**: content cleaning
  squeezed runs of blank lines everywhere, so a code sample with two blank
  lines between functions came out with one. Blank lines are now collapsed
  only outside code, including the whitespace-only lines left by indented
  HTML.

## [0.6.0] - 2026-08-31

### Fixed

- **`<TabItem label="A > B">` leaked tag fragments**: the TabItem label
  emitter cut its tag match at the first `>`, so a quoted label containing `>`
  dumped the rest of the tag into the output as prose. The matcher is now
  attribute-aware, like the PascalCase stripper.
- **Multi-line descriptions rendered as broken blockquotes**: a frontmatter
  description spanning lines quoted only its first line, leaving the rest as
  prose under the heading. Every line is now blockquoted.
- **`$` sequences corrupted partial content**: partial files were spliced
  with a string replacement, so shell/perl patterns like `echo $1`, `kill $$`,
  or `$&` in a partial's code samples were silently rewritten (attr values
  substituted, tags re-inserted, document fragments duplicated). The splice
  now ignores replacement patterns.
- **CRLF line endings corrupted output**: files authored or checked out with
  Windows line endings had their fenced code blocks unmasked (imports and HTML
  inside code samples were stripped) and their descriptions mis-extracted (a
  heading-only file got the heading as description; a heading-less file got
  the entire document). `readFile` now normalizes CRLF/CR to LF.
- **Root slug (`slug: "/"`) crossed version subtrees**: in multi-version
  mode, a section-root page linked to the current version's route (e.g.
  `/docs`) instead of its own version's (`/stable/docs`). Root-slug resolution
  now honors version and section scoping.
- **`siteConfig.url` with a trailing slash** produced `//baseUrl` in every
  generated URL, mismatching sitemap.xml.
- **`routeBasePath` with a leading/trailing slash** (e.g. `'/docs'`) silently
  disabled route scoping for that section, falling every doc back to
  heuristic URLs. Slashes are now normalized.
- **Blog detection misclassified sibling sections**: any directory whose name
  merely started with the blog dir (e.g. a `blog-api` docs section next to
  `blog`) was treated as the blog for fallback URL construction.
- **Code-fence samples containing `import` statements were rewritten**: a
  fenced sample of an import line was resolved as a real partial import and
  spliced the partial's content into the code sample (or dropped the line when
  the target did not exist). Partial-import resolution now runs on fence-masked
  content.
- **`llms-full.txt` flattened heading hierarchy**: each document's inner
  `## Foo` stayed at `##`, colliding with the `## {title}` document header, and
  the document's own title H1 appeared again under its header. Inner headings
  are now demoted one level under the document header, and the duplicate title
  heading is removed.
- **Individual `.md` files duplicated their title and intro**: the file header
  emitted `# {title}` plus the description blockquote, then the body repeated
  the identical H1 and (for pages whose description was auto-extracted from
  the first paragraph) the identical paragraph. Both duplicates are now
  stripped from the body.
- **Triple blank lines in `llms-full.txt`**: stripping a body's duplicate
  title heading left its surrounding blank lines behind. Gaps now collapse to
  a single blank line.
- **Numeric frontmatter `description` dropped**: an unquoted YAML number
  (`description: 2024`) was silently discarded instead of used as text; it is
  now coerced like `title`/`slug`/`id`.
- **`applyMdExtension` mangled bare origins**: a bare site URL would become
  `https://site.com.md`; the trailing slash is now preserved.

### Added

- **`preserveComponents` option**: an array of MDX/JSX component names whose
  tags pass through untouched instead of being stripped, for components that
  render meaningful content themselves (e.g. a swizzled
  `<PackageManagerTabs command="add my-package" />`). Matching is exact on
  the component name, and tags inside code fences are still left alone.
  ([#64](https://github.com/rachfop/docusaurus-plugin-llms/issues/64))
- **CI workflow**: the repository now runs build + unit + integration tests on
  Node 18/20/22 for every pull request and push to `main`.

### Fixed

- **Prop content lost in JSX stripping**: the attribute-aware stripper
  (0.5.0) dropped non-`children` prop values wholesale, deleting content like
  the command inside `<PackageManagerTabs command="..." />`. Attribute values
  are now parsed and their text is preserved. ([#68](https://github.com/rachfop/docusaurus-plugin-llms/pull/68),
  [#64](https://github.com/rachfop/docusaurus-plugin-llms/issues/64))
- **`<TabItem>` collapsed its label**: `<TabItem>` tags now degrade to a
  readable outline instead of a bare body: the `label` (or `value`) is emitted
  as a bold line before the tab body. ([#64](https://github.com/rachfop/docusaurus-plugin-llms/issues/64))
- **Imported MDX page bodies silently dropped**: only imports whose path
  contained `_` or `/partials/` were inlined; a normally-named `.mdx` page body
  imported as a component was stripped without its content. Every `.mdx`/`.md`
  import is now inlined, and imports using webpack-style aliases other than
  `@site` (e.g. `@global/components/x.mdx`) resolve against the site directory.
  Failed resolutions warn with the specifier and importing file. ([#65](https://github.com/rachfop/docusaurus-plugin-llms/issues/65))
- **Imports inside partial code fences stripped**: when a partial was inlined,
  `import` lines inside its fenced code samples were removed. Code fences are
  masked before partial splicing, so samples survive verbatim. ([#69](https://github.com/rachfop/docusaurus-plugin-llms/pull/69))
- **Absolute slugs double-prefixed**: a frontmatter `slug` starting with `/`
  was prefixed with the route base path again, producing URLs like
  `.../docs/team-b/docs/faq.md`. Absolute slugs are now used as-is. ([#63](https://github.com/rachfop/docusaurus-plugin-llms/pull/63))
- **Multiple `docsDir` entries collapsed to the first**: with
  `docsDir: ['docs', 'blog']`, every page resolved to the first matching
  section, mis-routing pages and leaking `blog` URLs into `docs` output.
  Sections now resolve per-file, routes are scoped per-section, and the new
  `blogDir`/`blogRouteBasePath` options configure a blog alongside docs. ([#67](https://github.com/rachfop/docusaurus-plugin-llms/pull/67))

### Documentation

- README restructured into a full `docs/` site: installation, configuration,
  output files, content cleaning, best practices, and per-feature guides. ([#61](https://github.com/rachfop/docusaurus-plugin-llms/pull/61))
- Corrected the JSDoc default for `generateMarkdownFiles`. ([#62](https://github.com/rachfop/docusaurus-plugin-llms/pull/62))
- New "Validating the deployed output" section in best practices. ([#66](https://github.com/rachfop/docusaurus-plugin-llms/pull/66))

### Thanks

This release exists because of its contributors. Thanks to everyone who
opened pull requests: [adeelehsan](https://github.com/adeelehsan),
[AlexAdiaconitei](https://github.com/AlexAdiaconitei),
[anupamme](https://github.com/anupamme), [canuto](https://github.com/canuto),
[deka0106](https://github.com/deka0106), [F-OBrien](https://github.com/F-OBrien),
[ilanazholobovsky](https://github.com/ilanazholobovsky),
[kingsword09](https://github.com/kingsword09), [Konkrad](https://github.com/Konkrad),
[nicolasiscoding](https://github.com/nicolasiscoding),
[portdeveloper](https://github.com/portdeveloper),
[puehringer](https://github.com/puehringer), [scottamain](https://github.com/scottamain),
[smol-ninja](https://github.com/smol-ninja), [statico](https://github.com/statico),
and [svrnm](https://github.com/svrnm).

Thanks to everyone who filed issues that shaped this release:
[allxsmith](https://github.com/allxsmith), [anvme](https://github.com/anvme),
[benfoster](https://github.com/benfoster), [canuto](https://github.com/canuto),
[critesjosh](https://github.com/critesjosh), [ctauchen](https://github.com/ctauchen),
[cyrusmith](https://github.com/cyrusmith), [dineshpinto](https://github.com/dineshpinto),
[emertechie](https://github.com/emertechie), [fflaten](https://github.com/fflaten),
[ilanazholobovsky](https://github.com/ilanazholobovsky),
[johngrimes](https://github.com/johngrimes), [manuelmeurer](https://github.com/manuelmeurer),
[nicolasiscoding](https://github.com/nicolasiscoding), [PaulRBerg](https://github.com/PaulRBerg),
[prdai](https://github.com/prdai), [quangdusk](https://github.com/quangdusk),
[Rajesh11082005](https://github.com/Rajesh11082005), [ratansen](https://github.com/ratansen),
[Rob-Purbrick](https://github.com/Rob-Purbrick), [scottamain](https://github.com/scottamain),
[smol-ninja](https://github.com/smol-ninja),
[sujanmoi-kasm](https://github.com/sujanmoi-kasm), [thomhurst](https://github.com/thomhurst),
[wparad](https://github.com/wparad), and [yada](https://github.com/yada).
If you reported a problem, tested a pre-release, or shared feedback along
the way, that work made 0.6.0 better. Thank you.

## [0.5.1] - 2026-07-22

### Fixed

- **Numeric frontmatter `slug`/`id` ignored**: an unquoted numeric `slug`/`id`
  (YAML parses `slug: 2025` as a number) is now coerced to a string, matching how
  Docusaurus routes it, so the `.md` is written at the correct route instead of a
  fallback filename. ([#58](https://github.com/rachfop/docusaurus-plugin-llms/issues/58))
- **`baseUrl` applied twice on disk**: with a non-root `baseUrl`, individual
  `.md` files were written nested under the baseUrl segment, so their links
  404'd. The baseUrl path is now stripped before deriving the physical file
  location. ([#59](https://github.com/rachfop/docusaurus-plugin-llms/pull/59))
- **Compound numeric prefixes**: ordering prefixes are now parsed like
  Docusaurus's `DefaultNumberPrefixParser` (e.g. `03--1.6.X` → `1.6.X`), and
  version-like names such as `7.0-foo` are preserved. ([#59](https://github.com/rachfop/docusaurus-plugin-llms/pull/59))
- **Explicit frontmatter `slug`/`id` overridden by a coincidental route**: an
  authoritative `slug`/`id` (including `slug: "/"`) is now consulted before the
  filename-tail heuristic, so a root page no longer loses its route to an
  unrelated file. ([#59](https://github.com/rachfop/docusaurus-plugin-llms/pull/59))

## [0.5.0] - 2026-07-17

### Added

- **Multi-version output** via a new `versions` option. Generate a separate set
  of LLM files per documentation version, each written under its own
  subdirectory with links scoped to that version's routes. Accepts an explicit
  array of versions (`{ name, label, docsDir, path, customLLMFiles, includeOrder }`)
  or `'auto'` to detect them from Docusaurus docs versioning (`versions.json` +
  `versioned_docs/`). Omitting `versions` preserves the existing single-root
  behavior. Unset per-version fields fall back to the top-level options.

## [0.4.5] - 2026-07-13

### Fixed

- **Code samples corrupted by content cleaning**: HTML/JSX tag stripping, `import` removal (`excludeImports`), image-URL rewriting, and title detection now skip fenced code blocks and inline code, so examples shown in code blocks are preserved verbatim.
- **Global `version` option ignored**: it's now included in `llms.txt`/`llms-full.txt` (previously only per-custom-file `version` worked).
- **`draft: "true"`**: quoted-string frontmatter is now skipped like the boolean `true`.
- **MDX/JSX component tags**: tags like `<Tabs>`/`<TabItem>` are now stripped from generated text, keeping their inner content.
- **Custom-file `includeUnmatchedLast`**: now defaults to `true` (matching standard files), so `includePatterns`-selected docs aren't dropped when `orderPatterns` doesn't list them.
- **`pathTransformation.ignorePaths`**: no longer leaves a trailing slash when removing a terminal segment, and tolerates entries written with a trailing slash.
- **`buildImageAssetMap`**: no longer indexes non-image build assets.

## [0.4.4] - 2026-07-13

### Fixed

- **`.md` links returning 404** (#41) : `addMdExtension` appended `.md` to `llms.txt` links by default, but the `.md` files are only produced when `generateMarkdownFiles` is enabled, so the links pointed to files that didn't exist. `.md` is now appended only when the markdown files are actually generated; otherwise links point to the normal doc routes.

## [0.4.3] - 2026-07-13

### Added

- **`useRelativeUrls` option** (#37, #42) : opt-in (`false` by default) that emits origin-relative links in `llms.txt` (e.g. `/docs/page.md`) instead of absolute URLs. Useful for subpath deployments where the site `url` can't be pinned to the real deployment host. The baseUrl portion of the path is preserved.

## [0.4.2] - 2026-07-13

### Fixed

- **baseUrl dropped from generated URLs** (#43) : sites deployed to a subpath (e.g. `baseUrl: '/docs/'`) had the base path silently discarded, producing links to the wrong location. The baseUrl pathname is now preserved on both the resolved-route and fallback code paths, and is added to a route only when not already present (so it's never dropped or duplicated).
- **Trailing slash in `docsDir`** (#43) : a `docsDir` like `'foo/'` produced a doubled slash that prevented the prefix from being stripped. The prefix is now normalized before use.

## [0.4.1] - 2026-07-13

### Added

- **`rewriteImageUrls` option**: opt-in (`false` by default) that rewrites relative image references (`./img/`, `../img/`, `../../img/`, etc.) in generated `.md` files and `llms-full.txt` to absolute hashed URLs served by the site (e.g. `https://site.com/assets/images/diagram-abc123.png`). Resolves images being inaccessible to LLMs reading the served markdown.
  - Scans `build/assets/images/` after the build and builds a basename → hashed-path lookup map.
  - Uses byte-comparison to disambiguate when two source images share the same filename.
  - Images not bundled by Docusaurus (e.g. unreferenced files) are left unchanged.

- **Generated `.md` paths now match page URLs**: when `generateMarkdownFiles: true`, each file is placed at the path derived from the resolved Docusaurus route (e.g. `guia/setup.md`) rather than a title-slugified name, so the `.md` is reachable at the same URL as the HTML page with a `.md` extension.

- **Numeric ordering prefix stripping**: `01-`, `02-` style prefixes are now stripped from every path segment when deriving output paths, matching the clean URLs that Docusaurus itself produces.

## [0.3.1] - 2026-04-14

### Fixed

- **[#31]** Doubled `docs/docs/` paths when `routeBasePath: '/'` and docs live in a nested `docs/` subdirectory
- **[#30]** `trailingSlash: true` not reflected in generated URLs

### Changed

- Replaced `routeMap` construction with suffix-based matching against Docusaurus's `routesPaths`, removing ~150 lines of production code and five edge-case helper functions
- `pathTransformation` is now only applied as a fallback when a file cannot be matched to a known Docusaurus route

## [0.3.0] - 2026-02-07

### Fixed

#### Critical Bug Fixes (GitHub Issues)

- **[#19]** PluginOptions type compatibility with Docusaurus - Added index signature to resolve TypeScript errors ([322f17a](https://github.com/rachfop/docusaurus-plugin-llms/commit/322f17a))
- **[#23]** YAML encoding for special characters and emojis - Added proper YAML.stringify options ([adce852](https://github.com/rachfop/docusaurus-plugin-llms/commit/adce852))
- **[#25]** includeOrder pattern matching - Now matches against both site-relative and docs-relative paths ([14e21e5](https://github.com/rachfop/docusaurus-plugin-llms/commit/14e21e5))
- **[#15]** Numbered prefix handling - Uses Docusaurus resolved routes before manual prefix removal ([b28c6c9](https://github.com/rachfop/docusaurus-plugin-llms/commit/b28c6c9))

#### Data Integrity & Validation

- Strip UTF-8 BOM from markdown files to prevent parsing errors ([1aa2f8a](https://github.com/rachfop/docusaurus-plugin-llms/commit/1aa2f8a))
- Validate and handle empty frontmatter fields ([d16ff49](https://github.com/rachfop/docusaurus-plugin-llms/commit/d16ff49))
- Add type validation for frontmatter properties ([54aa9a4](https://github.com/rachfop/docusaurus-plugin-llms/commit/54aa9a4))
- Add error handling for URL constructor to prevent crashes ([e00fbfc](https://github.com/rachfop/docusaurus-plugin-llms/commit/e00fbfc))
- Add proper URL encoding for path segments ([2629e6f](https://github.com/rachfop/docusaurus-plugin-llms/commit/2629e6f))
- Escape regex special characters in ignorePath to prevent syntax errors ([c1039ed](https://github.com/rachfop/docusaurus-plugin-llms/commit/c1039ed))
- Prevent regex lastIndex state leakage in import detection ([057f6ac](https://github.com/rachfop/docusaurus-plugin-llms/commit/057f6ac))

#### Path & File Handling

- Improve filename sanitization to preserve valid characters ([ebb89d8](https://github.com/rachfop/docusaurus-plugin-llms/commit/ebb89d8))
- Add path length validation and shortening for Windows compatibility ([0a7e7f2](https://github.com/rachfop/docusaurus-plugin-llms/commit/0a7e7f2))
- Handle whitespace-only strings in path operations ([696e30d](https://github.com/rachfop/docusaurus-plugin-llms/commit/696e30d))
- Handle slugs with / as nested directory paths ([ae371f1](https://github.com/rachfop/docusaurus-plugin-llms/commit/ae371f1))
- Correct baseUrl concatenation logic ([84c9a39](https://github.com/rachfop/docusaurus-plugin-llms/commit/84c9a39))

#### Safety & Robustness

- Add bounds checking for array access to prevent undefined propagation ([3cebd65](https://github.com/rachfop/docusaurus-plugin-llms/commit/3cebd65), [ff77b91](https://github.com/rachfop/docusaurus-plugin-llms/commit/ff77b91))
- Add iteration limit to prevent infinite loops in path collision detection ([61a859b](https://github.com/rachfop/docusaurus-plugin-llms/commit/61a859b))
- Add iteration limit to unique identifier generation ([3248176](https://github.com/rachfop/docusaurus-plugin-llms/commit/3248176))
- Standardize null/undefined handling patterns ([1e24c75](https://github.com/rachfop/docusaurus-plugin-llms/commit/1e24c75))
- Improve error type safety with unknown instead of any ([d2894f3](https://github.com/rachfop/docusaurus-plugin-llms/commit/d2894f3))
- Standardize empty collection handling with consistent logging ([40846c5](https://github.com/rachfop/docusaurus-plugin-llms/commit/40846c5))

#### Performance & Scalability

- Add batch processing to prevent OOM on large sites (1000+ pages) ([caa85a2](https://github.com/rachfop/docusaurus-plugin-llms/commit/caa85a2))

### Added

#### Features

- Configurable logging system for better debugging and quieter output ([79dab0d](https://github.com/rachfop/docusaurus-plugin-llms/commit/79dab0d))
- Comprehensive input validation utilities ([112ad2c](https://github.com/rachfop/docusaurus-plugin-llms/commit/112ad2c))
- Ignored files warning feature for better user feedback ([c6559c1](https://github.com/rachfop/docusaurus-plugin-llms/commit/c6559c1))

#### Documentation

- Add batch processing documentation to README ([6df318b](https://github.com/rachfop/docusaurus-plugin-llms/commit/6df318b))
- Improve JSDoc documentation for normalizePath function ([0e1b0d8](https://github.com/rachfop/docusaurus-plugin-llms/commit/0e1b0d8))
- Add pattern matching documentation and examples ([14e21e5](https://github.com/rachfop/docusaurus-plugin-llms/commit/14e21e5))
- Add numbered prefix handling documentation ([b28c6c9](https://github.com/rachfop/docusaurus-plugin-llms/commit/b28c6c9))

### Changed

#### Code Quality Improvements

- Extract nested conditionals to helper functions ([5e31591](https://github.com/rachfop/docusaurus-plugin-llms/commit/5e31591))
- Extract magic numbers to named constants and improve truncation ([9d95f4b](https://github.com/rachfop/docusaurus-plugin-llms/commit/9d95f4b))

### Testing

- Add integration test for plugin options validation ([1db8a94](https://github.com/rachfop/docusaurus-plugin-llms/commit/1db8a94), [e690ffc](https://github.com/rachfop/docusaurus-plugin-llms/commit/e690ffc))
- Add comprehensive filename sanitization tests ([16de4d9](https://github.com/rachfop/docusaurus-plugin-llms/commit/16de4d9))
- Add comprehensive Windows path normalization tests ([4151051](https://github.com/rachfop/docusaurus-plugin-llms/commit/4151051))
- Add YAML encoding test suite ([adce852](https://github.com/rachfop/docusaurus-plugin-llms/commit/adce852))
- Add pattern matching test suite with 8 scenarios ([14e21e5](https://github.com/rachfop/docusaurus-plugin-llms/commit/14e21e5))
- Add numbered prefix test suite ([b28c6c9](https://github.com/rachfop/docusaurus-plugin-llms/commit/b28c6c9))
- Add URL encoding tests ([2629e6f](https://github.com/rachfop/docusaurus-plugin-llms/commit/2629e6f))
- Add URL error handling tests ([e00fbfc](https://github.com/rachfop/docusaurus-plugin-llms/commit/e00fbfc))
- Add regex escaping tests ([c1039ed](https://github.com/rachfop/docusaurus-plugin-llms/commit/c1039ed))
- Add regex lastIndex tests ([057f6ac](https://github.com/rachfop/docusaurus-plugin-llms/commit/057f6ac))
- Add whitespace path tests ([696e30d](https://github.com/rachfop/docusaurus-plugin-llms/commit/696e30d))
- Add unique identifier iteration limit tests ([3248176](https://github.com/rachfop/docusaurus-plugin-llms/commit/3248176))
- Add batch processing tests ([caa85a2](https://github.com/rachfop/docusaurus-plugin-llms/commit/caa85a2))
- Add input validation tests ([112ad2c](https://github.com/rachfop/docusaurus-plugin-llms/commit/112ad2c))
- Add BOM handling tests ([1aa2f8a](https://github.com/rachfop/docusaurus-plugin-llms/commit/1aa2f8a))
- Add path length validation tests ([0a7e7f2](https://github.com/rachfop/docusaurus-plugin-llms/commit/0a7e7f2))
- Add nested path tests ([ae371f1](https://github.com/rachfop/docusaurus-plugin-llms/commit/ae371f1))
- Add baseURL handling tests ([84c9a39](https://github.com/rachfop/docusaurus-plugin-llms/commit/84c9a39))
- **Total:** 300+ tests across 50 test files, all passing

### Technical Details

This release focuses on stability, robustness, and addressing edge cases. Key improvements:

- **Windows Compatibility**: Path length validation, proper path normalization
- **Large Site Support**: Batch processing prevents OOM on sites with 1000+ pages
- **Type Safety**: Improved TypeScript types, proper error handling
- **Input Validation**: Comprehensive validation prevents crashes from invalid input
- **Pattern Matching**: Flexible pattern matching supports multiple path formats
- **URL Handling**: Robust URL construction with proper encoding and error handling
- **Frontmatter Parsing**: Handles special characters, emojis, and edge cases
- **Code Quality**: Reduced complexity, extracted helper functions, named constants

### Breaking Changes

None. This release maintains backward compatibility with v0.2.x.

### Migration Guide

No migration required. All changes are backward compatible.

[#19]: https://github.com/rachfop/docusaurus-plugin-llms/issues/19
[#23]: https://github.com/rachfop/docusaurus-plugin-llms/issues/23
[#25]: https://github.com/rachfop/docusaurus-plugin-llms/issues/25
[#15]: https://github.com/rachfop/docusaurus-plugin-llms/issues/15
[0.3.0]: https://github.com/rachfop/docusaurus-plugin-llms/compare/v0.2.2...v0.3.0

## [0.2.0] - 2025-01-20

### Added

- **Custom Root Content**: Support for customizable root-level content in generated files
  - New `rootContent` option for customizing the introductory content in `llms.txt`
  - New `fullRootContent` option for customizing the introductory content in `llms-full.txt`
  - Custom root content support for individual custom LLM files
  - Follows llmstxt.org standard allowing markdown sections after title/description
  - Enables project-specific context, technical specifications, and navigation hints

- **Docusaurus Partials Support**: Full support for Docusaurus partial files (MDX files prefixed with underscore)
  - Automatically excludes partial files (e.g., `_shared.mdx`) from being processed as standalone documents
  - Resolves and inlines partial content when imported in other documents
  - Handles both default and named imports: `import Partial from './_partial.mdx'`
  - Replaces JSX usage `<Partial />` with the actual partial content
  - Maintains source markdown approach while supporting partials

### Fixed

- **URL Resolution**: Plugin now uses actual resolved URLs from Docusaurus routes instead of guessing paths
  - Properly handles numbered prefixes in file names (e.g., `1-page.md` → `/docs/page`)
  - Uses Docusaurus's route data from the `postBuild` lifecycle hook
  - Falls back to the original path construction for backward compatibility
  - Adds comprehensive route matching including nested folders with numbered prefixes

### Technical Details

- **Partial Resolution**:
  - Partial files (starting with `_`) are automatically excluded from `readMarkdownFiles`
  - New `resolvePartialImports` function processes import statements and inlines content
  - Supports relative imports and properly resolves file paths
  - Gracefully handles errors with warnings if partials can't be resolved

- **Route Resolution**:
  - The plugin now receives route information from Docusaurus via the `postBuild` props
  - Creates a route map from all available routes (including nested routes)
  - Attempts multiple matching strategies to find the correct resolved URL:
    1. Direct route map lookup
    2. Numbered prefix removal at various path levels
    3. Fuzzy matching using `routesPaths` array
    4. Falls back to original path construction if no match found
  - Maintains backward compatibility with older Docusaurus versions or test environments

## [0.1.3] - 2024-05-20

### Added

- Version information support for LLM files
  - Global version setting for all generated files
  - Individual version settings for custom LLM files
  - "Version: X.Y.Z" displayed under description in all generated files
- Version information follows llmstxt.org standards for LLM-friendly documentation

### Benefits

- Provides clear versioning for LLM documentation files
- Helps AI tools and users track which version of documentation they're working with
- Allows content creators to maintain multiple versions of AI-friendly docs

## [0.1.2] - Previous release

Initial release with basic functionality.
