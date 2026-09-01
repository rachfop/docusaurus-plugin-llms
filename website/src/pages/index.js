import React from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

/**
 * Landing page for the docs site. Minimal hero that routes readers into the
 * docs and points at the live dogfooded llms.txt output.
 */
export default function Home() {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description="LLM-friendly documentation files for your Docusaurus site, following the llmstxt.org standard."
    >
      <main style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <h1>{siteConfig.title}</h1>
        <p>
          Generate <code>llms.txt</code>, <code>llms-full.txt</code>, and clean
          markdown files from your Docusaurus docs during build, so language
          models can consume them without parsing HTML.
        </p>
        <p>
          <Link className="button button--primary button--lg" to="/docs/overview">
            Read the docs
          </Link>
        </p>
        <p style={{ marginTop: '2rem' }}>
          This site runs the plugin on its own docs — check the live output at{' '}
          <a href="/docusaurus-plugin-llms/llms.txt">llms.txt</a>.
        </p>
      </main>
    </Layout>
  );
}
