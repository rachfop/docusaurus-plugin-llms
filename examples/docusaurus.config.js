/**
 * Example Docusaurus configuration using the LLMs plugin
 */

// This is just an example file and doesn't need type checking
const themes = {
  github: {},
  dracula: {},
};

const config = {
  title: 'My Documentation Site',
  tagline: 'Documentation made for humans and LLMs',
  favicon: 'img/favicon.ico',

  url: 'https://my-website.com',
  baseUrl: '/',

  organizationName: 'my-org',
  projectName: 'my-project',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  // Example 1: Basic usage
  plugins: ['docusaurus-plugin-llms'],

  // Example 2: With options (uncomment to use)
  // plugins: [
  //   [
  //     'docusaurus-plugin-llms',
  //     {
  //       // Generate only the full content file
  //       generateLLMsTxt: true,
  //       generateLLMsFullTxt: true,
  //
  //       // Custom base directory (if your docs are in a different folder)
  //       docsDir: 'documentation',
  //
  //       // Ignore specific files or directories
  //       ignoreFiles: [
  //         'private/*',
  //         'unreleased/*',
  //         '**/drafts/**'
  //       ],
  //
  //       // Custom title and description
  //       title: 'My Project API Documentation',
  //       description: 'Complete reference material for My Project API',
  //
  //       // Custom filenames
  //       llmsTxtFilename: 'documentation-index.txt',
  //       llmsFullTxtFilename: 'documentation-full.txt',
  //
  //       // Include blog posts
  //       includeBlog: true
  //     }
  //   ]
  // ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.js',
          editUrl: 'https://github.com/my-org/my-project/tree/main/website/',
        },
        blog: {
          showReadingTime: true,
          editUrl: 'https://github.com/my-org/my-project/tree/main/website/',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'My Project',
      logo: {
        alt: 'My Project Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        { to: '/blog', label: 'Blog', position: 'left' },
        {
          href: 'https://github.com/my-org/my-project',
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
              href: 'https://stackoverflow.com/questions/tagged/my-project',
            },
            {
              label: 'Discord',
              href: 'https://discord.gg/my-project',
            },
            {
              label: 'Twitter',
              href: 'https://twitter.com/my-project',
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
              href: 'https://github.com/my-org/my-project',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
    },
    prism: {
      theme: themes.github,
      darkTheme: themes.dracula,
    },
  },
};

module.exports = config;
