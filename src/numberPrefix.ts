/**
 * Number-prefix parsing that mirrors Docusaurus's DefaultNumberPrefixParser
 * (packages/docusaurus-plugin-content-docs/src/numberPrefix.ts), so generated
 * file paths and route-matching tails use the same clean names Docusaurus
 * itself produces. Both the URL-path deriver (generator) and the route matcher
 * (processor) must strip prefixes identically, so this lives in one place —
 * two copies would silently drift the next time a Docusaurus edge case lands.
 *
 * The separator between the number and the rest of the name is one-or-more of
 * `-`, `_`, `.` (so a compound prefix like "03--1.6.X" resolves to "1.6.X", not
 * "-1.6.X"), and a prefix is not stripped when the remainder itself looks like
 * a version/date number (e.g. "7.0-foo" stays "7.0-foo").
 */
const IGNORED_NUMBER_PREFIX_PATTERN = /^\d+[-_.]\d+/;
const NUMBER_PREFIX_PATTERN = /^(\d+)\s*[-_.]+\s*([^-_.\s].*)$/;

/**
 * Strip a leading ordering prefix from a single path segment (e.g. "01-intro"
 * → "intro"), leaving version/date-like names intact.
 * @param segment - One path segment
 * @returns The segment without its ordering prefix
 */
export function stripNumberPrefix(segment: string): string {
  if (IGNORED_NUMBER_PREFIX_PATTERN.test(segment)) {
    return segment;
  }
  const match = NUMBER_PREFIX_PATTERN.exec(segment);
  return match ? match[2] : segment;
}

/**
 * Strip ordering prefixes from every segment of a `/`-joined path.
 * @param pathStr - A `/`-joined path
 * @returns The path with each segment's ordering prefix removed
 */
export function stripPathNumberPrefixes(pathStr: string): string {
  return pathStr.split('/').map(stripNumberPrefix).join('/');
}
