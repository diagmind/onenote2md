import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { Config } from './types';

/**
 * Load configuration from a URL or local file
 */
export async function loadConfig(configUrl: string): Promise<Config> {
  try {
    if (configUrl.startsWith('http')) {
      // Remote config
      const response = await axios.get<Config>(configUrl);
      return response.data;
    } else {
      // Local config
      const configPath = path.resolve(configUrl);
      const configData = await fs.readFile(configPath, 'utf-8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.error(`Failed to load config: ${error}`);
    throw error;
  }
}

/**
 * Get DOCX URLs from configuration
 */
export function getDocxUrls(config: Config, baseUrl: string): Map<string, string> {
  const urlMap = new Map<string, string>();
  
  // Find the "input" section (indicated by "輸入" in the example)
  const inputSection = config.find(section => section.text === '輸入');
  
  if (!inputSection) {
    throw new Error('Input section not found in config');
  }
  
  // Map each item's link to the full URL
  inputSection.items.forEach(item => {
    const fullUrl = `${baseUrl}${item.link}`;
    urlMap.set(item.text, fullUrl);
  });
  
  return urlMap;
}

/**
 * Get output paths from configuration
 */
export function getOutputPaths(config: Config): Map<string, { link: string, display?: string }> {
  const pathMap = new Map<string, { link: string, display?: string }>();
  
  // Find the "output" section (indicated by "輸出" in the example)
  const outputSection = config.find(section => section.text === '輸出');
  
  if (!outputSection) {
    throw new Error('Output section not found in config');
  }
  
  // Map each item's text to its link and display properties
  outputSection.items.forEach(item => {
    pathMap.set(item.text, { 
      link: item.link,
      display: item.display
    });
  });
  
  return pathMap;
}

/**
 * Generates l1toc.json file in the output directory based on the "輸出" section of the config.
 */
export async function getl1toc(config: Config, outputDir: string): Promise<void> {
  const outputSection = config.find(section => section.text === '輸出');

  if (!outputSection) {
    console.warn('Output section ("輸出") not found in config. Skipping l1toc.json generation.');
    return;
  }

  const categories = outputSection.items.map(item => {
    const category: { name: string; url: string; display?: string } = {
      name: item.text,
      url: item.link+'/index.html',
    };
    if (item.display) {
      category.display = item.display;
    }
    return category;
  });

  const l1tocData = { categories };
  const outputPath = path.join(outputDir, 'l1toc.json');

  try {
    await fs.ensureDir(outputDir); // Ensure output directory exists
    await fs.writeFile(outputPath, JSON.stringify(l1tocData, null, 2), 'utf-8');
    console.log(`Successfully wrote l1toc.json to ${outputPath}`);
  } catch (error) {
    console.error(`Failed to write l1toc.json: ${error}`);
    throw error;
  }
}
