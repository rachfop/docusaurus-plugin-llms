/**
 * Image asset mapping and relative-image-URL rewriting for generated markdown.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Dirent } from 'fs';
import { maskCodeSegments } from './content';

/** Image extensions recognised by Docusaurus / browsers (regex alternation). */
const IMAGE_EXTENSIONS = 'png|jpe?g|gif|svg|webp|bmp|ico|avif|tiff?';

/**
 * Scan `{outDir}/assets/images/` and build a reverse-lookup map used to
 * rewrite relative image references to their hashed build-output URLs.
 *
 * Bundlers (webpack / Rspack) output images as `{original-name}-{hash}.{ext}`.
 * We strip the trailing `-{hex}` portion to recover the original basename and
 * use it as the lookup key.  When two images share the same basename but have
 * different content (different hashes) both entries are kept so a later
 * byte-comparison step can disambiguate them.
 *
 * @param outDir - Docusaurus build output directory (e.g., `<siteDir>/build`)
 * @returns Map from original-basename (e.g., `diagram.png`) to one or more
 *          site-root-relative hashed paths (e.g., `/assets/images/diagram-abc.png`)
 */
export async function buildImageAssetMap(outDir: string): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  const imagesDir = path.join(outDir, 'assets', 'images');

  let entries: Dirent[];
  try {
    entries = await fs.readdir(imagesDir, { withFileTypes: true });
  } catch {
    return map; // Directory doesn't exist — no images
  }

  // Match `{original-name}-{16..64 hex chars}.{ext}` produced by webpack/Rspack
  const hashSuffixRe = new RegExp(`^(.+)-([0-9a-f]{16,64})(\\.(?:${IMAGE_EXTENSIONS}))$`, 'i');

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const name = entry.name;
    const m = name.match(hashSuffixRe);
    // key = original filename without the hash suffix, e.g. "diagram.png"
    const key = m ? `${m[1]}${m[3]}` : name;

    const assetPath = `/assets/images/${name}`;
    const existing = map.get(key);
    if (existing) {
      existing.push(assetPath);
    } else {
      map.set(key, [assetPath]);
    }
  }

  return map;
}

/**
 * Rewrite relative image references in markdown content to absolute URLs
 * pointing to the hashed build output in `assets/images/`.
 *
 * Handles:
 *   - Markdown images:  `![alt](./img/foo.png)`
 *   - HTML img tags:    `<img src="./img/foo.png" />`  (both quote styles)
 *
 * Resolution strategy:
 *   1. Extract the basename from the relative path (e.g., `foo.png`).
 *   2. Look it up in `imageAssetMap` (built by `buildImageAssetMap`).
 *   3. One candidate  → rewrite immediately.
 *   4. Multiple candidates → read source file bytes and compare against each
 *      candidate to find the exact match.  Falls back to keeping the original
 *      path if the source file cannot be read.
 *   5. Zero candidates → keep the original path as-is (static/ images, etc.).
 *
 * @param content        - Cleaned markdown content to process
 * @param sourceFilePath - Absolute path of the source `.md` file (used to
 *                         resolve relative image paths and for byte comparison)
 * @param imageAssetMap  - Lookup map built by `buildImageAssetMap`
 * @param siteUrl        - Site base URL used to build absolute image URLs
 * @param outDir         - Build output directory (needed for byte comparison)
 * @returns Content with rewritten image URLs
 */
export async function rewriteRelativeImageUrls(
  content: string,
  sourceFilePath: string,
  imageAssetMap: Map<string, string[]>,
  siteUrl: string,
  outDir: string
): Promise<string> {
  const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  const sourceDir = path.dirname(sourceFilePath);

  // Mask code so image syntax shown inside code blocks isn't rewritten.
  const { masked, restore } = maskCodeSegments(content);

  const imgExtRe = new RegExp(`\\.(?:${IMAGE_EXTENSIONS})$`, 'i');

  // Matches relative image references regardless of how many `../` levels deep.
  //   Group 1+2: Markdown  `![alt](./rel/path.ext)`     prefix + path
  //   Group 3+4: HTML      `src="./rel/path.ext"`       prefix + path
  //
  // The path group starts with `.` (captures `./`, `../`, `../../`, etc.).
  // Image-extension filtering is done separately with imgExtRe so we don't
  // accidentally miss legitimate multi-level paths.
  const imageRefRe = /(!\[[^\]]*\]\()(\.[^)"'\s]+)|(src=["'])(\.[^"'\s]+)/gi;

  // Collect unique relative paths that point to image files
  const uniquePaths = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = imageRefRe.exec(masked)) !== null) {
    const relPath = m[2] ?? m[4]; // markdown group or HTML group
    if (imgExtRe.test(relPath.split('?')[0].split('#')[0])) {
      uniquePaths.add(relPath);
    }
  }

  if (uniquePaths.size === 0) return content;

  // Resolve each unique path to an absolute URL (cached)
  const resolved = new Map<string, string>(); // relPath → absolute URL or original

  for (const relPath of uniquePaths) {
    const basename = path.basename(relPath.split('?')[0].split('#')[0]);
    const candidates = imageAssetMap.get(basename) ?? [];

    let assetPath: string | null = null;

    if (candidates.length === 1) {
      assetPath = candidates[0];
    } else if (candidates.length > 1) {
      // Multiple files with same basename — byte-compare to find the right one
      const absSource = path.resolve(sourceDir, relPath.split('?')[0].split('#')[0]);
      try {
        const srcBytes = await fs.readFile(absSource);
        for (const candidate of candidates) {
          try {
            const candidateBytes = await fs.readFile(path.join(outDir, candidate));
            if (srcBytes.equals(candidateBytes)) {
              assetPath = candidate;
              break;
            }
          } catch { /* candidate unreadable — skip */ }
        }
      } catch { /* source unreadable — keep original */ }
    }

    // Preserve any query string / fragment (e.g. "?raw=1", "#anchor") so we
    // don't change semantics for downstream tooling that relies on them.
    const suffixMatch = relPath.match(/[?#].*$/);
    const suffix = suffixMatch ? suffixMatch[0] : '';
    resolved.set(relPath, assetPath ? `${baseUrl}${assetPath}${suffix}` : relPath);
  }

  // Apply all substitutions in a single pass, then restore masked code.
  return restore(masked.replace(imageRefRe, (match, mdPrefix, mdPath, htmlPrefix, htmlPath) => {
    const relPath = mdPath ?? htmlPath;
    const target = resolved.get(relPath);
    if (!target || target === relPath) return match; // no change
    if (mdPrefix) return `${mdPrefix}${target}`;
    return `${htmlPrefix}${target}`;
  }));
}
