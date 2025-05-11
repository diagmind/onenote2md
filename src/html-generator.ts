import fs from 'fs-extra';
import path from 'path';

/**
 * Get the master HTML template
 */
export async function getMasterTemplate(): Promise<string> {
  try {
    const templatePath = path.join(__dirname, 'public', 'master.html');
    return await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error(`Error loading master template: ${error}`);
    throw error;
  }
}

/**
 * Create HTML files based on the configuration
 */
export async function createHtmlFiles(
  docxFiles: Map<string, [outputPath: string, url: string]>,
  outputPaths: Map<string, { link: string, display?: string }>,
  outputDir: string,
  sourceType: 'local' | 'remote',
  baseUrl?: string
): Promise<void> {
  try {
    // Get the master template
    const masterTemplate = await getMasterTemplate();

    // Process each item from the output config
    for (const [name, { link, display }] of outputPaths.entries()) {
      console.log(`Processing: ${name}`);
      // Get the output HTML path
      const htmlOutputPath = path.join(outputDir, link.replace(/^\//, ''));

      // Ensure the directory exists
      await fs.ensureDir(path.dirname(htmlOutputPath));
      // If display is "none", create a 403 page
      if (display === 'none') {
        const forbiddenTemplate = await fs.readFile(
          path.join(__dirname, 'public', '403.html'),
          'utf-8'
        );
        await fs.writeFile(`${htmlOutputPath}/index.html`, forbiddenTemplate);
        continue;
      }

      // Modify the HTML template
      let modifiedContent = masterTemplate;


      modifiedContent = modifiedContent.replace(
        './example.docx',
        sourceType === 'remote' ? docxFiles.get(name)![1] : `/docxView/${name}.docx`
      );

      // Replace ./public with ../public
      modifiedContent = modifiedContent.replace(/\.\/public/g, '../public');

      // Ensure the directory exists for the HTML file
      await fs.ensureDir(htmlOutputPath);

      // Write the HTML file
      await fs.writeFile(path.join(htmlOutputPath, 'index.html'), modifiedContent);
    }
  } catch (error) {
    console.error(`Error creating HTML files: ${error}`);
    throw error;
  }
}