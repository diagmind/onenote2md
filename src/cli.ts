#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { docx2html } from './index';
import { CLIOptions } from './types';
import { downloadMarkdownFromHtmlPages } from './markdown-downloader';
import { setupVitePress } from './vitepress-setup';

// Get package version from package.json
const { version } = require('../package.json');

const program = new Command();

program
  .name('onenote2md')
  .description('Convert DOCX files to HTML with configurable options')
  .version(version)
  .option('-u, --url <url>', 'base URL to download docx file from (e.g., https://diagmindtw.com/rawdocx/)')
  .option('-b, --configUrl <url>', 'URL to config file')
  .option('-s, --source <type>', 'Source type: "local" or "remote"', /^(local|remote)$/i)
  .option('-o, --output <path>', 'Output directory path', './output')
  .option('-w, --dev', 'Start server at http://127.0.0.1:48489 to view the HTML output')
  .option('-e, --debug', 'Enable debug mode to log each processing stage')
  .option('-m, --markdown', 'Download markdown files from generated HTML pages')
  .option('-p, --port <number>', 'Port for the dev server', '48489')
  .option('-t, --wait <ms>', 'Wait time in milliseconds for markdown download process', '5000')
  .option('-M, --autoMd', 'Combination of -s local -m --dev with auto-stop server when all markdown files are downloaded')
  .option('-v, --vitepress', 'Setup VitePress and build a static documentation site from markdown files')
  .action(async (options: CLIOptions) => {
    try {      // Handle the new autoMd flag
      if (options.autoMd) {
        // AutoMd flag cannot be used with source, markdown, or dev flags
        if (options.source || options.markdown || options.dev) {
          console.error('Error: The -M option cannot be used with -s, -m, or --dev options.');
          process.exit(1);
        }
        // Set the equivalent options
        options.source = 'local';
        options.markdown = true;
        options.dev = true;
      }
        // Make sure vitepress only runs after markdown download completes
      if (options.vitepress && !options.markdown) {
        console.error('Error: The -v (--vitepress) option requires -m (--markdown) or -M (--autoMd) option to be enabled.');
        console.log('VitePress requires markdown files to build the documentation site.');
        process.exit(1);
      }
      
      // If both vitepress and markdown are enabled without dev server, remind user about the dev server requirement
      if (options.vitepress && options.markdown && !options.dev) {
        console.error('Error: The -v and -m options together require --dev to be enabled.');
        console.log('Please run the command with --dev option to enable the dev server for markdown processing.');
        process.exit(1);
      }
      
      // Normalize paths
      if (options.output) {
        options.output = path.resolve(options.output);
      }
      
      // Save the options to a file for potential regeneration
      const optionsPath = path.join(process.cwd(), '.docx2html-options.json');
      await fs.writeFile(optionsPath, JSON.stringify(options, null, 2));
      
      // Set the environment variable for the options path
      process.env.DOCX2HTML_OPTIONS_PATH = optionsPath;
      
      await docx2html(options);
        // If markdown option is enabled, download markdown files
      if (options.markdown) {
        const baseUrl = `http://localhost:${options.port || '48489'}`;
        const waitTime = parseInt(options.wait || '5000');
        const outputPath = options.output || './output'; // Provide default path if undefined
          if (options.dev) {
          console.log(`Starting markdown download process with base URL: ${baseUrl}`);
          await downloadMarkdownFromHtmlPages(outputPath, baseUrl, waitTime, options.autoMd || false);
        } else {
          console.error('Error: The --markdown option requires --dev to be enabled.');
          console.log('Please run the command with --dev option to download markdown files.');
        }
      }      // Setup VitePress and build the site if the vitepress option is enabled
     /* if (options.vitepress) {
        console.log('Setting up VitePress and building the site from markdown files...');
        const outputPath = options.output || './output';
        const markdownDir = path.join(outputPath, 'markdown');
        await setupVitePress(markdownDir, outputPath);
      }*/
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });

// Add a separate command just for downloading markdown
/*program  .command('download-markdown')
  .description('Download markdown files from previously generated HTML pages')
  .option('-o, --output <path>', 'Output directory path with HTML files', './output')
  .option('-p, --port <number>', 'Port to use for local server', '48489')
  .option('-t, --wait <ms>', 'Wait time in milliseconds for each download', '5000')  .option('-a, --auto-stop', 'Automatically stop the server after all markdown files are downloaded')
  .option('-v, --vitepress', 'Set up VitePress and build the site after downloading markdown files')
  .action(async (cmdOptions) => {
    try {
      const outputDir = path.resolve(cmdOptions.output);
      const baseUrl = `http://localhost:${cmdOptions.port}`;
      const waitTime = parseInt(cmdOptions.wait);
      
      // Check if output directory exists
      if (!await fs.pathExists(outputDir)) {
        console.error(`Error: Output directory ${outputDir} does not exist.`);
        process.exit(1);
      }
      
      // Start the server
      const devServer = require('./dev-server');
      await devServer.startServer(outputDir, parseInt(cmdOptions.port));        console.log(`Starting markdown download process from: ${outputDir}`);
      await downloadMarkdownFromHtmlPages(outputDir, baseUrl, waitTime, cmdOptions.autoStop || false);
      
      // Set up VitePress if the option is enabled
      if (cmdOptions.vitepress) {
        const markdownDir = path.join(outputDir, 'markdown');
        await setupVitePress(markdownDir, outputDir);
      }
      
      // Stop the server if not in auto-stop mode
      if (!(cmdOptions.autoStop || false)) {
        process.exit(0);
      }
    } catch (error) {
      console.error(`Error downloading markdown: ${error}`);
      process.exit(1);
    }
  });*/

program.parse(process.argv);
