/**
 * logLevel 'quiet' must suppress info and warn output (LogLevel.QUIET is 0,
 * so a falsy fallback once mapped it to 'normal'), and processingBatchSize
 * must be a positive integer (0 or a negative value looped forever).
 */

const docusaurusPluginLLMs = require('../lib/index.js').default;
const { logger, setLogLevel, LogLevel } = require('../lib/logger.js');

const context = {
  siteDir: '/tmp/test-site',
  siteConfig: {
    title: 'Test Site',
    tagline: 'Test tagline',
    url: 'https://example.com',
    baseUrl: '/',
  },
  outDir: '/tmp/test-site/build',
};

let passed = 0;
let failed = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`  PASS: ${name}`);
    passed++;
  } else {
    console.log(`  FAIL: ${name}${detail ? `\n     ${detail}` : ''}`);
    failed++;
  }
}

function captureOutput(fn) {
  const lines = [];
  const original = { log: console.log, warn: console.warn };
  console.log = (...args) => lines.push(args.join(' '));
  console.warn = (...args) => lines.push(args.join(' '));
  try {
    fn();
  } finally {
    console.log = original.log;
    console.warn = original.warn;
  }
  return lines;
}

function initError(options) {
  try {
    docusaurusPluginLLMs(context, options);
    return null;
  } catch (err) {
    return err.message;
  }
}

console.log('Testing logLevel and processingBatchSize...\n');

for (const [level, expectInfo, expectVerbose] of [
  ['quiet', false, false],
  ['normal', true, false],
  ['verbose', true, true],
]) {
  docusaurusPluginLLMs(context, { logLevel: level });
  const lines = captureOutput(() => {
    logger.info('info line');
    logger.warn('warn line');
    logger.verbose('verbose line');
  });
  check(`logLevel '${level}': info/warn ${expectInfo ? 'shown' : 'hidden'}`,
    lines.includes('[docusaurus-plugin-llms] info line') === expectInfo &&
      lines.includes('[docusaurus-plugin-llms] warn line') === expectInfo,
    `got: ${JSON.stringify(lines)}`);
  check(`logLevel '${level}': verbose ${expectVerbose ? 'shown' : 'hidden'}`,
    lines.includes('[docusaurus-plugin-llms] verbose line') === expectVerbose,
    `got: ${JSON.stringify(lines)}`);
}
setLogLevel(LogLevel.NORMAL);

for (const bad of [0, -5, 2.5, '50', NaN]) {
  const message = initError({ processingBatchSize: bad });
  check(`processingBatchSize ${JSON.stringify(bad)} rejected`,
    message === 'processingBatchSize must be a positive integer',
    `got: ${message}`);
}
for (const good of [1, 50, 100]) {
  check(`processingBatchSize ${good} accepted`, initError({ processingBatchSize: good }) === null);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
