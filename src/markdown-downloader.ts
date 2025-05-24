import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';

/**
 * Download markdown files from all HTML pages
 */
export async function downloadMarkdownFromHtmlPages(
  outputDir: string,
  baseUrl: string = 'http://localhost:48489',
  waitTimeMs: number = 5000
): Promise<void> {
  let browser;
  
  try {
    console.log('Starting markdown download process...');
    
    // Get all directories in the output folder
    const directories = await fs.readdir(outputDir);
    const htmlPaths: string[] = [];
    
    // Find all HTML files
    for (const dir of directories) {
      const dirPath = path.join(outputDir, dir);
      const stat = await fs.stat(dirPath);
      
      if (stat.isDirectory()) {
        const indexPath = path.join(dirPath, 'index.html');
        if (await fs.pathExists(indexPath)) {
          htmlPaths.push(path.relative(outputDir, dirPath));
        }
      }
    }
    
    console.log(`Found ${htmlPaths.length} HTML pages to process`);
    
    if (htmlPaths.length === 0) {
      console.log('No HTML pages found to process. Exiting...');
      return;
    }

    // Setup the download directory
    const downloadDir = path.join(outputDir, 'markdown');
    await fs.ensureDir(downloadDir);
    console.log(`Markdown files will be saved to: ${downloadDir}`);
      // Launch a browser
    browser = await puppeteer.launch({ 
      headless: process.platform === 'win32' ? false : true, // Use headless mode on non-Windows
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set download behavior
    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir
    });
    
    // Set a viewport
    await page.setViewport({
      width: 1280,
      height: 800
    });
    
    // Process each HTML page
    for (let i = 0; i < htmlPaths.length; i++) {
      const htmlPath = htmlPaths[i];
      const url = `${baseUrl}/${htmlPath}`;
      
      console.log(`\nProcessing page ${i+1}/${htmlPaths.length}: ${url}`);
      
      try {
        // Navigate to the page
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for the page to load
        console.log('Waiting for container to be visible...');
        await page.waitForSelector('#container', { visible: true, timeout: 60000 });
        
        // Wait for the "Loading" to disappear
        console.log('Waiting for loader to disappear...');
        await page.waitForFunction(() => {
          const loader = document.getElementById('loader');
          return loader && loader.style.display === 'none';
        }, { timeout: 60000 });

        // Wait for the dropdown to be ready
        console.log('Waiting for dropdown menu to be ready...');
        await page.waitForSelector('.ui.dropdown.item', { visible: true, timeout: 30000 });
        
        // Click on the dropdown
        console.log('Clicking on dropdown menu...');
        await page.click('.ui.dropdown.item');
        
        // Wait for dropdown menu to open
        console.log('Waiting for markdown download option to appear...');
        await page.waitForSelector('.menu .item#DEVdownloadMarkdown', { visible: true, timeout: 15000 });
        
        // Click on the download markdown button
        console.log('Clicking on "Download Markdown" option...');
        await page.click('.menu .item#DEVdownloadMarkdown');
        
        // Wait for download to complete
        console.log(`Waiting ${waitTimeMs}ms for download to complete...`);
        await new Promise(resolve => setTimeout(resolve, waitTimeMs));
        
        console.log(`Successfully downloaded markdown from: ${htmlPath}`);
      } catch (error) {
        console.error(`Error processing ${url}: ${error}`);
        console.log('Continuing with next page...');
      }
    }
    
    console.log('\nMarkdown download process completed successfully!');
    console.log(`All markdown files saved to: ${downloadDir}`);
    
  } catch (error) {
    console.error(`Error downloading markdown files: ${error}`);
    throw error;
  } finally {
    // Always close the browser
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}
