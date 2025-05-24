import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';

/**
 * Interface for storing chapter information
 */
interface Chapter {
  name: string;
  path: string;
  sections: {
    id: string;
    title: string;
  }[];
}

/**
 * Download markdown files from all HTML pages
 */
export async function downloadMarkdownFromHtmlPages(
  outputDir: string,
  baseUrl: string = 'http://127.0.0.1:48489',
  waitTimeMs: number = 5000
): Promise<void> {
  let browser;
  
  try {
    console.log('Starting markdown download process...');
    
    // Setup the download directory
    const downloadDir = path.join(outputDir, 'markdown');
    await fs.ensureDir(downloadDir);
    console.log(`Markdown files will be saved to: ${downloadDir}`);
    
    // Read the table of contents to get chapter names
    const tocPath = path.join(outputDir, 'l1toc.json');
    if (!await fs.pathExists(tocPath)) {
      throw new Error('Table of contents file (l1toc.json) not found');
    }
    
    const tocData = await fs.readJson(tocPath);
    const chapters: Chapter[] = [];
    
    for (const category of tocData.categories) {
      const chapterPath = category.url.split('/')[1]; // Extract the folder name from URL
      chapters.push({
        name: category.name,
        path: chapterPath,
        sections: []
      });
    }
    
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

    // First pass: collect all sections from each chapter
    console.log('Collecting chapter and section information...');
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      const url = `${baseUrl}/${chapter.path}/index.html`;
      
      console.log(`\nScanning chapter ${i+1}/${chapters.length}: ${chapter.name} (${url})`);
      
      try {
        // Navigate to the page
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for the page to load
        await page.waitForSelector('#container', { visible: true, timeout: 60000 });
        
        // Wait for the "Loading" to disappear
        await page.waitForFunction(() => {
          const loader = document.getElementById('loader');
          return loader && loader.style.display === 'none';
        }, { timeout: 60000 });

        // Extract section information from the right sidebar
        const sections = await page.evaluate(() => {
          const sectionElements = document.querySelectorAll('.right-menu .item');
          return Array.from(sectionElements).map((el, index) => {
            const id = el.getAttribute('data-id') || String(index + 1);
            const title = el.textContent?.trim() || `Section ${index + 1}`;
            return { id, title };
          });
        });
        
        if (sections.length === 0) {
          console.log(`No sections found for chapter ${chapter.name}`);
        } else {
          console.log(`Found ${sections.length} sections for chapter ${chapter.name}`);
          chapter.sections = sections;
        }
      } catch (error) {
        console.error(`Error scanning chapter ${chapter.name}: ${error}`);
      }
    }
    
    // Second pass: download markdown files for each section
    console.log('\n===== Starting download process for each section =====');
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      
      if (chapter.sections.length === 0) {
        // If no sections found, try to download the main page as a single document
        console.log(`\nProcessing chapter ${i+1}/${chapters.length}: ${chapter.name} (no sections)`);
        await downloadMarkdownFromPage(page, `${baseUrl}/${chapter.path}/index.html`, downloadDir, `${chapter.name}-main`, waitTimeMs);
        continue;
      }
      
      for (let j = 0; j < chapter.sections.length; j++) {
        const section = chapter.sections[j];
        console.log(`\nProcessing chapter ${i+1}/${chapters.length}, section ${j+1}/${chapter.sections.length}: ${chapter.name} - ${section.title}`);
        
        // Create URL with section hash
        const url = `${baseUrl}/${chapter.path}/index.html#${section.id}`;
        
        // Generate filename
        const filename = `${chapter.name}-${section.id}`;
        
        await downloadMarkdownFromPage(page, url, downloadDir, filename, waitTimeMs);
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

/**
 * Download markdown from a specific page URL
 */
async function downloadMarkdownFromPage(
  page: any, // Using 'any' instead of puppeteer.Page to avoid namespace issue
  url: string, 
  downloadDir: string, 
  filenamePrefix: string,
  waitTimeMs: number
): Promise<void> {
  try {
    // Navigate to the page
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for the page to reload and load completely
    console.log('Waiting for page to fully load...');
    
    // Wait for the container to be visible
    await page.waitForSelector('#container', { visible: true, timeout: 60000 });
    
    // Wait for the "Loading" to disappear
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
    
    // Rename the most recently downloaded file
    const files = await fs.readdir(downloadDir);
    if (files.length > 0) {
      // Sort files by modified time (newest first)
      const fileStat = await Promise.all(
        files.map(async file => {
          const filePath = path.join(downloadDir, file);
          const stat = await fs.stat(filePath);
          return { file, stat };
        })
      );
      
      fileStat.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
      const latestFile = fileStat[0].file;
      
      // Only rename markdown files
      if (latestFile.endsWith('.md')) {
        const newFileName = `${filenamePrefix}.md`;
        const oldPath = path.join(downloadDir, latestFile);
        const newPath = path.join(downloadDir, newFileName);
        
        await fs.rename(oldPath, newPath);
        console.log(`Renamed downloaded file to: ${newFileName}`);
      }
    }
    
    console.log(`Successfully downloaded markdown from: ${url}`);
  } catch (error) {
    console.error(`Error processing ${url}: ${error}`);
    console.log('Continuing with next page...');
  }
}
