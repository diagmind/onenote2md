#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { docx2html } from './index';
import { CLIOptions } from './types';

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
  .option('-e, --debug', 'Enable debug mode to log each processing stage')  .action(async (options: CLIOptions) => {
    try {
      // Normalize paths
      if (options.output) {
        options.output = path.resolve(options.output);
      }
      
      // Save the options to a file for potential regeneration
      const fs = require('fs-extra');
      const optionsPath = path.join(process.cwd(), '.docx2html-options.json');
      await fs.writeFile(optionsPath, JSON.stringify(options, null, 2));
      
      // Set the environment variable for the options path
      process.env.DOCX2HTML_OPTIONS_PATH = optionsPath;
      
      await docx2html(options);
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
