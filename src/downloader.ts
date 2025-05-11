import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';

/**
 * Download a DOCX file from a URL
 */
export async function downloadDocx(url: string, outputPath: string): Promise<string> {
  try {
    console.log(`Downloading DOCX from: ${url}`);

    // Make sure the directory exists
    await fs.ensureDir(path.dirname(outputPath));

    // Download the file
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    // Write the file to disk
    const writer = fs.createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(outputPath));
      writer.on('error', reject);
    });
  } catch (error) {
    console.error(`Error downloading file from ${url}: ${error}`);
    throw error;
  }
}

/**
 * Download multiple DOCX files
 */
export async function downloadDocxFiles(
  urlMap: Map<string, string>,
  outputDir: string
  , rl: boolean
): Promise<Map<string, [outputPath: string, url: string]>> {
  const downloadedFiles = new Map<string,  [outputPath: string, url: string]>();

  for (const [name, url] of urlMap.entries()) {
    const outputPath = path.join(outputDir, `${name}.docx`);
    await downloadDocx(url, outputPath);
    downloadedFiles.set(name, [outputPath, url]);
  }

  return downloadedFiles;
}
