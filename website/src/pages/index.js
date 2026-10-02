import React, { useState } from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

const INSTALL_COMMAND = 'npm install docusaurus-plugin-llms --save-dev';

/**
 * Sample output for the hero's file window, abridged from what this site's
 * own build writes. `url` is filled in at render time so links carry the
 * site's baseUrl.
 */
const FILES = [
  {
    name: 'llms.txt',
    note: 'An index: one link and summary per page.',
    lines: (site) => [
      ['h1', '# docusaurus-plugin-llms'],
      ['blank', ''],
      ['quote', '> LLM-friendly docs for your Docusaurus site'],
      ['blank', ''],
      ['h2', '## Table of Contents'],
      ['blank', ''],
      [
        'item',
        `- [Overview](${site}/docs/overview.md): What the plugin generates and when it runs.`,
      ],
      [
        'item',
        `- [Installation](${site}/docs/installation.md): Install, register, and check the output.`,
      ],
      [
        'item',
        `- [Configuration options](${site}/docs/configuration.md): Every option, type, and default.`,
      ],
      [
        'item',
        `- [Content cleaning](${site}/docs/content-cleaning.md): Strip HTML, imports, and echoes.`,
      ],
    ],
  },
  {
    name: 'llms-full.txt',
    note: 'Every page, cleaned and concatenated into one file.',
    lines: () => [
      ['h1', '# docusaurus-plugin-llms'],
      ['blank', ''],
      ['quote', '> LLM-friendly docs for your Docusaurus site'],
      ['blank', ''],
      ['h2', '## Overview'],
      ['blank', ''],
      ['text', '`docusaurus-plugin-llms` generates LLM-friendly documentation'],
      ['text', 'from your Docusaurus site, following the llmstxt standard.'],
      ['blank', ''],
      ['h3', '### What it does'],
    ],
  },
  {
    name: 'docs/overview.md',
    note: 'A Markdown copy next to each HTML page, when enabled.',
    lines: () => [
      ['h1', '# Overview'],
      ['blank', ''],
      ['quote', '> What the plugin generates and when it runs.'],
      ['blank', ''],
      ['text', 'The plugin needs no configuration. It runs in the Docusaurus'],
      ['text', '`postBuild` hook, so it generates files during `npm run build`.'],
      ['blank', ''],
      ['h2', '## What it does'],
      ['blank', ''],
      ['item', '- Generates `llms.txt` with links to each documentation page.'],
    ],
  },
];

const GUIDES = [
  {
    to: '/docs/content-generation',
    label: 'Custom LLM files',
    detail: 'One file per language, product, or audience.',
  },
  {
    to: '/docs/content-cleaning',
    label: 'Content cleaning',
    detail: 'Drop MDX imports, HTML, and repeated headings.',
  },
  {
    to: '/docs/ordering-and-paths',
    label: 'Ordering',
    detail: 'Put pages in reading order with glob patterns.',
  },
  {
    to: '/docs/multi-version',
    label: 'Multi-version',
    detail: 'A separate llms.txt for each docs version.',
  },
];

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function CopyCommand() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the command stays selectable.
    }
  };
  return (
    <div className={styles.command}>
      <span className={styles.prompt} aria-hidden="true">
        $
      </span>
      <code className={styles.commandText}>{INSTALL_COMMAND}</code>
      <button
        type="button"
        className={styles.copy}
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy install command'}
        title={copied ? 'Copied' : 'Copy'}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
      <span className={styles.srOnly} aria-live="polite">
        {copied ? 'Install command copied' : ''}
      </span>
    </div>
  );
}

function FileWindow({ siteUrl }) {
  const [active, setActive] = useState(0);
  const file = FILES[active];
  const lines = file.lines(siteUrl);
  return (
    <figure className={styles.window}>
      <div className={styles.tabs} role="tablist" aria-label="Generated files">
        {FILES.map((f, i) => (
          <button
            key={f.name}
            type="button"
            role="tab"
            id={`file-tab-${i}`}
            aria-selected={i === active}
            aria-controls="file-panel"
            className={i === active ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setActive(i)}
          >
            {f.name}
          </button>
        ))}
      </div>
      <pre
        key={file.name}
        id="file-panel"
        role="tabpanel"
        aria-labelledby={`file-tab-${active}`}
        className={styles.file}
        tabIndex={0}
      >
        {lines.map(([kind, text], i) => (
          <span
            key={i}
            className={`${styles.line} ${styles[kind]}`}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            {text || ' '}
          </span>
        ))}
      </pre>
      <figcaption className={styles.caption}>
        <span className={styles.captionPath}>build/{file.name}</span>
        <span>{file.note}</span>
      </figcaption>
    </figure>
  );
}

export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  const siteUrl = `${siteConfig.url}${siteConfig.baseUrl}`.replace(/\/$/, '');
  const llmsTxtUrl = useBaseUrl('/llms.txt');
  const llmsFullTxtUrl = useBaseUrl('/llms-full.txt');

  return (
    <Layout
      title="llms.txt for Docusaurus"
      description="A Docusaurus plugin that writes llms.txt, llms-full.txt, and Markdown copies of your docs during the production build."
    >
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>A Docusaurus plugin for the llmstxt.org standard</p>
          <h1 className={styles.title}>
            Your Docusaurus docs,
            <br />
            <span className={styles.titleMuted}>readable by language models</span>
          </h1>
          <p className={styles.lede}>
            During <code>npm run build</code>, the plugin writes an <code>llms.txt</code> index, an{' '}
            <code>llms-full.txt</code> bundle, and a Markdown copy of every page, so a model reads
            your docs without parsing HTML.
          </p>
          <div className={styles.actions}>
            <CopyCommand />
            <Link className={styles.textLink} to="/docs/installation">
              Get started <span aria-hidden="true">›</span>
            </Link>
            <a className={styles.textLink} href={llmsTxtUrl}>
              See this site's llms.txt <span aria-hidden="true">›</span>
            </a>
          </div>
        </section>

        <section className={styles.preview} aria-label="Generated files">
          <FileWindow siteUrl={siteUrl} />
        </section>

        <section className={styles.setup} aria-labelledby="setup-heading">
          <div className={styles.setupText}>
            <h2 id="setup-heading" className={styles.sectionTitle}>
              One line of config
            </h2>
            <p>
              Add the plugin and build. With no options, it reads <code>docs/</code> and writes both
              files to the build output. Titles and summaries come from each page's front matter.
            </p>
            <Link className={styles.textLink} to="/docs/configuration">
              All configuration options →
            </Link>
          </div>
          <pre className={styles.config}>
            <span className={styles.cComment}>// docusaurus.config.js</span>
            {'\n'}module.exports = {'{'}
            {'\n'} plugins: [<span className={styles.cString}>'docusaurus-plugin-llms'</span>],
            {'\n'}
            {'}'};
          </pre>
        </section>

        <section className={styles.guides} aria-labelledby="guides-heading">
          <h2 id="guides-heading" className={styles.sectionTitle}>
            When the defaults aren't enough
          </h2>
          <ol className={styles.guideList}>
            {GUIDES.map((g) => (
              <li key={g.to}>
                <Link className={styles.guide} to={g.to}>
                  <span className={styles.guideLabel}>{g.label}</span>
                  <span className={styles.guideDetail}>{g.detail}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className={styles.dogfood}>
            This site runs the plugin on its own docs. Read the output:{' '}
            <a href={llmsTxtUrl}>llms.txt</a> · <a href={llmsFullTxtUrl}>llms-full.txt</a>
          </p>
        </section>
      </main>
    </Layout>
  );
}
