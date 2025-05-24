import path from 'path';
import fs from 'fs-extra';
import { loadConfig, getDocxUrls, getOutputPaths,getl1toc } from './config';
import { downloadDocxFiles } from './downloader';
import { createHtmlFiles } from './html-generator';
import { startDevServer } from './dev-server';
import { DebugLogger } from './debug';
import { CLIOptions } from './types';
import { downloadMarkdownFromHtmlPages } from './markdown-downloader';

// Export the markdown downloader function
export { downloadMarkdownFromHtmlPages } from './markdown-downloader';
export { startServer, stopServer } from './dev-server';

/**
 * Main function that processes DOCX files and converts them to HTML
 */
export async function docx2html(options: CLIOptions): Promise<void> {
  try {
    // Set default values
    const outputDir = options.output || path.join(process.cwd(), 'output');
    const sourceType = options.source || 'local';

    // Create debug logger
    const debugLogger = new DebugLogger(options.debug || false, outputDir);

    // Ensure output directory exists
    await fs.ensureDir(outputDir);

    // Step 1: Load configuration
    if (!options.configUrl) {
      throw new Error('Configuration URL is required');
    }

    const config = await loadConfig(options.configUrl);
    getl1toc(config, outputDir);
    await debugLogger.log('config', config);

    // Step 2: Get DOCX URLs
    const baseUrl = options.url || '';
    const docxUrls = getDocxUrls(config, baseUrl);
    await debugLogger.log('docx-urls', Object.fromEntries(docxUrls));
    // Step 3: Download DOCX files
    let docxFiles: Map<string,[outputPath: string, url: string]>;

    console.log('Downloading DOCX files from remote URLs...');
    docxFiles = await downloadDocxFiles(docxUrls, path.join(outputDir, 'docxView'), sourceType === 'remote' ? true : false);

    await debugLogger.log('docx-files', Object.fromEntries(docxFiles));

    // Step 4-6: Create HTML files
    const outputPaths = getOutputPaths(config);
    await debugLogger.log('output-paths', Object.fromEntries(outputPaths));

    await createHtmlFiles(docxFiles, outputPaths, outputDir, sourceType, baseUrl);

    console.log(`DOCX files converted successfully. Output saved to: ${outputDir}`);

    // Copy static directory to output directory and rename "dist" to "public"
    const staticDir = path.join(__dirname, 'static');
    const publicDir = path.join(outputDir, 'public');

    console.log(`Copying static files from ${staticDir} to ${publicDir}...`);
    await fs.copy(staticDir, publicDir);

    console.log('Static files copied successfully.');

    // Delete the 'docxView' directory if source is 'remote'
    if (sourceType === 'remote') {
      const docxViewDir = path.join(outputDir, 'docxView');
      console.log(`Deleting temporary directory: ${docxViewDir}...`);
      await fs.remove(docxViewDir);
      console.log('Temporary directory deleted successfully.');
    }

    // Step 7-8: Start development server if requested
    if (options.dev) {
      startDevServer(outputDir);
    }
  } catch (error) {
    console.error(`Error converting DOCX to HTML: ${error}`);
    throw error;
  }
}
