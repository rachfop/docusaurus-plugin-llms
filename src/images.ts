/**
 * Image asset mapping and relative-image-URL rewriting for generated markdown.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Dirent } from 'fs';
import { maskCodeSegments } from './content';
import { isDefined } from './guards';

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
 * Find the build-output copy of a site file under a static directory: for
 * `<siteDir>/<dir>/<p>`, the file `<outDir>/<p>` with the same bytes (each
 * leading directory is tried as the static directory, shortest first).
 * Returns its site-root-relative URL path, or null when there is none.
 */
async function findStaticCopy(
  sourceFile: string,
  siteDir: string,
  outDir: string,
): Promise<string | null> {
  const segments = path.relative(siteDir, sourceFile).split(path.sep);
  if (segments[0] === '..' || path.isAbsolute(segments[0])) return null;
  let srcBytes: Buffer;
  try {
    srcBytes = await fs.readFile(sourceFile);
  } catch {
    return null;
  }
  for (let i = 1; i < segments.length; i++) {
    const rel = segments.slice(i);
    try {
      if (srcBytes.equals(await fs.readFile(path.join(outDir, ...rel)))) {
        return `/${rel.join('/')}`;
      }
    } catch {
      /* no copy at this depth */
    }
  }
  return null;
}

/**
 * Rewrite relative image references in markdown content to absolute URLs
 * pointing to the hashed build output in `assets/images/`.
 *
 * Handles:
 *   - Markdown images:  `![alt](./img/foo.png)`, `![alt](img/foo.png)`,
 *                       `![alt](<./my img.png>)`, `![alt](./my%20img.png)`
 *   - HTML img tags:    `<img src="./img/foo.png" />`  (both quote styles)
 *
 * As in Docusaurus, a markdown image path that is not absolute, root-relative,
 * or an alias resolves against the source file's directory, and is
 * percent-decoded before the lookup. When `siteDir` is given, a `@site/<p>`
 * path resolves to `<siteDir>/<p>`: Docusaurus bundles it like a relative
 * image, so it takes the same lookup. A `@site/` image with no bundled asset
 * (one small enough to be inlined as a data URI) that the build serves from a
 * static directory (`@site/static/<p>` copied to `<outDir>/<p>`, confirmed by
 * comparing bytes) is rewritten to `<siteUrl><p>`.
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
 * @param siteDir        - Site directory, for resolving `@site/` image paths
 * @returns Content with rewritten image URLs
 */
export async function rewriteRelativeImageUrls(
  content: string,
  sourceFilePath: string,
  imageAssetMap: Map<string, string[]>,
  siteUrl: string,
  outDir: string,
  siteDir?: string,
): Promise<string> {
  const baseUrl = siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
  const sourceDir = path.dirname(sourceFilePath);

  // Mask code so image syntax shown inside code blocks isn't rewritten.
  const { masked, restore } = maskCodeSegments(content);

  const imgExtRe = new RegExp(`\\.(?:${IMAGE_EXTENSIONS})$`, 'i');

  // Matches relative image references regardless of how many `../` levels deep.
  //   Group 1+2: Markdown  `![alt](<rel/path.ext>)`    prefix + path in <...>
  //   Group 1+3: Markdown  `![alt](rel/path.ext)`      prefix + path
  //   Group 4+5: HTML      `src="./rel/path.ext"`      prefix + path
  //
  // The HTML path group starts with `.` (captures `./`, `../`, `../../`,
  // etc.). Markdown paths are filtered with isRelative, and image-extension
  // filtering is done separately with imgExtRe so we don't accidentally miss
  // legitimate multi-level paths.
  const imageRefRe = /(!\[[^\]]*\]\()(?:<([^<>\n]+)>|([^)"'\s<>]+))|(src=["'])(\.[^"'\s]+)/gi;
  const isSiteAlias = (p: string): boolean => isDefined(siteDir) && p.startsWith('@site/');
  const isRelative = (p: string): boolean =>
    isSiteAlias(p) || !/^(?:[a-z][a-z0-9+.-]*:|[/#@~])/i.test(p);
  // The file-system path a reference names: no query/fragment, percent-decoded.
  const toFsPath = (ref: string): string => {
    const bare = ref.split('?')[0].split('#')[0];
    try {
      return decodeURIComponent(bare);
    } catch {
      return bare;
    }
  };

  // The source file an image reference names.
  const toSourceFile = (ref: string): string =>
    isSiteAlias(ref)
      ? path.join(siteDir!, toFsPath(ref).slice('@site/'.length))
      : path.resolve(sourceDir, toFsPath(ref));

  // Collect unique relative paths that point to image files
  const uniquePaths = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = imageRefRe.exec(masked)) !== null) {
    const relPath = m[2] ?? m[3] ?? m[5]; // markdown groups or HTML group
    if (isRelative(relPath) && imgExtRe.test(toFsPath(relPath))) {
      uniquePaths.add(relPath);
    }
  }

  if (uniquePaths.size === 0) return content;

  // Resolve each unique path to an absolute URL (cached)
  const resolved = new Map<string, string>(); // relPath → absolute URL or original

  for (const relPath of uniquePaths) {
    const basename = path.basename(toFsPath(relPath));
    const candidates = imageAssetMap.get(basename) ?? [];

    let assetPath: string | null = null;

    if (candidates.length === 1) {
      assetPath = candidates[0];
    } else if (candidates.length > 1) {
      // Multiple files with same basename — byte-compare to find the right one
      const absSource = toSourceFile(relPath);
      try {
        const srcBytes = await fs.readFile(absSource);
        for (const candidate of candidates) {
          try {
            const candidateBytes = await fs.readFile(path.join(outDir, candidate));
            if (srcBytes.equals(candidateBytes)) {
              assetPath = candidate;
              break;
            }
          } catch {
            /* candidate unreadable — skip */
          }
        }
      } catch {
        /* source unreadable — keep original */
      }
    }

    // A `@site/<dir>/<p>` image with no bundled asset: the build output
    // serves it at `/<p>` when `<dir>` is a static directory, which copies
    // its files to the output root. Matching bytes confirm the copy.
    if (!assetPath && isSiteAlias(relPath)) {
      assetPath = await findStaticCopy(toSourceFile(relPath), siteDir!, outDir);
    }

    // Preserve any query string / fragment (e.g. "?raw=1", "#anchor") so we
    // don't change semantics for downstream tooling that relies on them.
    const suffixMatch = relPath.match(/[?#].*$/);
    const suffix = suffixMatch ? suffixMatch[0] : '';
    // Percent-encode characters that would end a markdown link destination
    // (an asset keeps the source file's name, spaces included).
    const assetUrl = assetPath?.replace(
      /[\s()<>]/g,
      (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`,
    );
    resolved.set(relPath, assetUrl ? `${baseUrl}${assetUrl}${suffix}` : relPath);
  }

  // Apply all substitutions in a single pass, then restore masked code.
  return restore(
    masked.replace(imageRefRe, (match, mdPrefix, mdAnglePath, mdPath, htmlPrefix, htmlPath) => {
      const relPath = mdAnglePath ?? mdPath ?? htmlPath;
      const target = resolved.get(relPath);
      if (!target || target === relPath) return match; // no change
      if (mdAnglePath) return `${mdPrefix}<${target}>`;
      if (mdPrefix) return `${mdPrefix}${target}`;
      return `${htmlPrefix}${target}`;
    }),
  );
}
