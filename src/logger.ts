/**
 * Logging utilities for the docusaurus-plugin-llms plugin.
 */

/**
 * Logging level enumeration
 */
export enum LogLevel {
  QUIET = 0,
  NORMAL = 1,
  VERBOSE = 2
}

let currentLogLevel = LogLevel.NORMAL;

/**
 * Set the logging level for the plugin
 * @param level - The logging level to use
 */
export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

/**
 * Logger utility for consistent logging across the plugin
 */
export const logger = {
  error: (message: string) => {
    console.error(`[docusaurus-plugin-llms] ERROR: ${message}`);
  },
  warn: (message: string) => {
    if (currentLogLevel >= LogLevel.NORMAL) {
      console.warn(`[docusaurus-plugin-llms] ${message}`);
    }
  },
  info: (message: string) => {
    if (currentLogLevel >= LogLevel.NORMAL) {
      console.log(`[docusaurus-plugin-llms] ${message}`);
    }
  },
  verbose: (message: string) => {
    if (currentLogLevel >= LogLevel.VERBOSE) {
      console.log(`[docusaurus-plugin-llms] ${message}`);
    }
  }
};
