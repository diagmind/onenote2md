#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { docx2html } from './index';
import { CLIOptions } from './types';
import { downloadMarkdownFromHtmlPages } from './markdown-downloader';

// Get package version from package.json
const { version } = require('../package.json');

const program = new Command();

program
  .name('docx2html')
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
  .action(async (options: CLIOptions) => {
    try {
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
          await downloadMarkdownFromHtmlPages(outputPath, baseUrl, waitTime);
        } else {
          console.error('Error: The --markdown option requires --dev to be enabled.');
          console.log('Please run the command with --dev option to download markdown files.');
        }
      }
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });

// Add a separate command just for downloading markdown
program
  .command('download-markdown')
  .description('Download markdown files from previously generated HTML pages')
  .option('-o, --output <path>', 'Output directory path with HTML files', './output')
  .option('-p, --port <number>', 'Port to use for local server', '48489')
  .option('-t, --wait <ms>', 'Wait time in milliseconds for each download', '5000')
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
      await devServer.startServer(outputDir, parseInt(cmdOptions.port));
      
      console.log(`Starting markdown download process from: ${outputDir}`);
      await downloadMarkdownFromHtmlPages(outputDir, baseUrl, waitTime);
      
      // Stop the server
      process.exit(0);
    } catch (error) {
      console.error(`Error downloading markdown: ${error}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
