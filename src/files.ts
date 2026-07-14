/**
 * Filesystem read/write helpers.
 */

import * as fs from 'fs/promises';

/**
 * Write content to a file
 * @param filePath - Path to write the file to
 * @param data - Content to write
 */
export async function writeFile(filePath: string, data: string): Promise<void> {
  return fs.writeFile(filePath, data, 'utf8');
}

/**
 * Read content from a file
 * @param filePath - Path of the file to read
 * @returns Content of the file with BOM removed if present
 */
export async function readFile(filePath: string): Promise<string> {
  let content = await fs.readFile(filePath, 'utf8');

  // Remove UTF-8 BOM if present
  // UTF-8 BOM is the character U+FEFF at the start of the file
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }

  return content;
}
