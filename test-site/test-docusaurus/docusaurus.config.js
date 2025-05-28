const lightCodeTheme = require('prism-react-renderer/themes/github');
const darkCodeTheme = require('prism-react-renderer/themes/dracula');

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
(module.exports = {
  title: 'My Site',
  tagline: 'Dinosaurs are cool',
  url: 'https://your-docusaurus-test-site.com',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  favicon: 'img/favicon.ico',
  organizationName: 'facebook', // Usually your GitHub org/user name.
  projectName: 'docusaurus', // Usually your repo name.

  plugins: [
    [
      'docusaurus-plugin-llms',
      /** @type {import("docusaurus-plugin-llms").PluginOptions} */
      ({
        // Basic plugin options
        siteTitle: 'Enhanced Test Documentation',
        siteDescription: 'A comprehensive test suite for docusaurus-plugin-llms',
        pathTransformation: {
          ignorePaths: ['docs'],
          addPaths: ['api', 'reference'],
        },
        includeBlog: true,
        version: '2.0.0',
        
        // Output file options
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        llmsTxtFilename: 'llms-index.txt',
        llmsFullTxtFilename: 'llms-content.txt',
        
        // File filtering options
        ignoreFiles: [
          '**/*.test.md',
          '**/private/**',
          '**/internal-docs/**',
        ],
        
        // Content ordering
        includeOrder: [
          '**/getting-started/*.md',
          '**/core/*.md', 
          '**/api/*.md',
          '**/guides/*.md',
          '**/examples/*.md',
        ],
        includeUnmatchedLast: true,
        
        // Custom LLM files for different use cases
        customLLMFiles: [
          {
            filename: 'api-reference.txt',
            title: 'API Reference Documentation',
            description: 'Complete API reference for developers',
            includePatterns: ['**/api/**/*.md', '**/reference/**/*.md'],
            orderPatterns: ['**/api/overview.md', '**/*.md'],
            fullContent: true,
            version: '1.0.0'
          },
          {
            filename: 'tutorials.txt',
            title: 'Tutorials and Guides',
            description: 'Step-by-step tutorials and guides',
            includePatterns: ['**/tutorials/**/*.md', '**/guides/**/*.md'],
            ignorePatterns: ['**/advanced/**/*.md'],
            fullContent: true,
            version: '0.9.5-beta'
          },
          {
            filename: 'quick-reference.txt',
            title: 'Quick Reference',
            description: 'Concise reference with links to full documentation',
            includePatterns: ['**/*.md'],
            fullContent: false,
            version: '1.1.0'
          }
        ]
      })
    ],
  ],

  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          // Please change this to your repo.
          editUrl: 'https://github.com/facebook/docusaurus/edit/main/website/',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          editUrl:
            'https://github.com/facebook/docusaurus/edit/main/website/blog/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: 'My Site',
        logo: {
          alt: 'My Site Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'doc',
            docId: 'intro',
            position: 'left',
            label: 'Tutorial',
          },
          {to: '/blog', label: 'Blog', position: 'left'},
          {
            href: 'https://github.com/facebook/docusaurus',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              {
                label: 'Tutorial',
                to: '/docs/intro',
              },
            ],
          },
          {
            title: 'Community',
            items: [
              {
                label: 'Stack Overflow',
                href: 'https://stackoverflow.com/questions/tagged/docusaurus',
              },
              {
                label: 'Discord',
                href: 'https://discordapp.com/invite/docusaurus',
              },
              {
                label: 'Twitter',
                href: 'https://twitter.com/docusaurus',
              },
            ],
          },
          {
            title: 'More',
            items: [
              {
                label: 'Blog',
                to: '/blog',
              },
              {
                label: 'GitHub',
                href: 'https://github.com/facebook/docusaurus',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
      },
    }),
});
