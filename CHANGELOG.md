# Changelog

All notable changes to the docusaurus-plugin-llms will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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