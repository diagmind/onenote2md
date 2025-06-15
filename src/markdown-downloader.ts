import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';
import { JSDOM } from 'jsdom';

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
  waitTimeMs: number = 5000,
  autoStopServer: boolean = false
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
    
    // Track the expected total number of markdown files
    let totalExpectedFiles = 0;
    
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

        // Extract section information from the right menu
        const sectionInfo = await page.evaluate(() => {
          // Look for the right menu elements
          const rightMenuItems = document.querySelectorAll('#rightMenu .item');
          if (rightMenuItems && rightMenuItems.length > 0) {
            // If right menu items exist, extract them
            return Array.from(rightMenuItems).map((el, index) => {
              const href = el.getAttribute('href') || '';
              const id = href.split('#')[1] || (index + 1).toString();
              const title = el.textContent?.trim() || `Section ${index + 1}`;
              return { id, title };
            });
          } else {
            // If no right menu is found, try to determine the number of sections from the JavaScript
            const hashIDX = document.body.innerHTML.match(/var\s+hashIDX\s*=\s*(\d+);/);
            const maxSection = hashIDX ? parseInt(hashIDX[1], 10) : 0;
            
            // Create section objects based on the max number
            const sections = [];
            for (let i = 1; i <= maxSection; i++) {
              sections.push({
                id: i.toString(),
                title: `Section ${i}`
              });
            }
            return sections;
          }
        });
        
        if (sectionInfo.length === 0) {
          console.log(`No sections found for chapter ${chapter.name}`);
          // If no sections found, we'll have at least one file for the main page
          totalExpectedFiles++;
        } else {
          console.log(`Found ${sectionInfo.length} sections for chapter ${chapter.name}`);
          chapter.sections = sectionInfo;
          totalExpectedFiles += sectionInfo.length;
        }
      } catch (error) {
        console.error(`Error scanning chapter ${chapter.name}: ${error}`);
      }
    }
    
    // Second pass: download markdown files for each section
    console.log('\n===== Starting download process for each section =====');
    console.log(`Total expected markdown files: ${totalExpectedFiles}`);
    
    // Track the number of successfully downloaded files
    let downloadedFilesCount = 0;
    
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
        if (chapter.sections.length === 0) {
        // If no sections found, try to download the main page as a single document
        console.log(`\nProcessing chapter ${i+1}/${chapters.length}: ${chapter.name} (no sections)`);
        
        const filename = {
          chapterPath: chapter.path,
          chapterName: chapter.name,
          sectionNumber: 'main'
        };
          const success = await downloadMarkdownFromPage(page, `${baseUrl}/${chapter.path}/index.html`, downloadDir, filename, waitTimeMs);
        if (success) {
          downloadedFilesCount++;
          console.log(`Progress: ${downloadedFilesCount}/${totalExpectedFiles} files downloaded (${Math.round((downloadedFilesCount/totalExpectedFiles)*100)}%)`);
        }
        continue;
      }
      
      for (let j = 0; j < chapter.sections.length; j++) {
        const section = chapter.sections[j];
        console.log(`\nProcessing chapter ${i+1}/${chapters.length}, section ${j+1}/${chapter.sections.length}: ${chapter.name} - ${section.title}`);
          // Create URL with section hash
        const url = `${baseUrl}/${chapter.path}/index.html#${section.id}`;
          // Generate initial filename with chapter path and section number
        // Final filename will be constructed after getting the page title
        const filename = {
          chapterPath: chapter.path,
          chapterName: chapter.name,
          sectionNumber: section.id
        };
        
        const success = await downloadMarkdownFromPage(page, url, downloadDir, filename, waitTimeMs);
        if (success) {
          downloadedFilesCount++;
          console.log(`Progress: ${downloadedFilesCount}/${totalExpectedFiles} files downloaded (${Math.round((downloadedFilesCount/totalExpectedFiles)*100)}%)`);
        }
        downloadedFilesCount++;
      }
    }
      // Calculate completion percentage
    const completionPercentage = Math.round((downloadedFilesCount / totalExpectedFiles) * 100);
    console.log('\n===== Markdown Download Summary =====');
    console.log(`Download process completed with ${completionPercentage}% success rate`);
    console.log(`Files downloaded: ${downloadedFilesCount}/${totalExpectedFiles}`);
    console.log(`All markdown files saved to: ${downloadDir}`);
      // Auto-stop the server if requested
    if (autoStopServer) {
      console.log('\n===== Auto-Stop Feature =====');
      console.log('Auto-stop enabled: Stopping the dev server now...');
      
      try {
        // Import the stopServer function
        const { stopServer } = await import('./dev-server');
        stopServer();
        
        console.log('Dev server stopped successfully.');
        
        // Exit the process if running in auto mode
        console.log('All markdown files have been downloaded. Exiting in 3 seconds...');
        
        // Give some time for the final logs to be visible
        setTimeout(() => {
          process.exit(0);
        }, 3000);
      } catch (error) {
        console.error(`Error stopping dev server: ${error}`);
        
        // Force exit after a timeout even if there's an error
        console.log('Forcing exit in 5 seconds...');
        setTimeout(() => {
          process.exit(1);
        }, 5000);
      }
    }
    
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
  filenameInfo: string | { chapterPath: string, chapterName: string, sectionNumber: string },
  waitTimeMs: number
): Promise<boolean> { // Return success status
  try {
    // Navigate to the page with full page reload
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Wait for the page to fully load
    console.log('Waiting for page to fully load...');
    
    // Wait for the container to be visible with retry mechanism
    let retryCount = 0;
    const maxRetries = 3;
    let containerLoaded = false;
    
    while (!containerLoaded && retryCount < maxRetries) {
      try {
        // Wait for the container to be visible
        await page.waitForSelector('#container', { visible: true, timeout: 60000 });
        containerLoaded = true;
      } catch (error) {
        retryCount++;
        console.log(`Container not visible after 60 seconds. Retry attempt ${retryCount}/${maxRetries}`);
        if (retryCount < maxRetries) {
          console.log('Reloading the page...');
          await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
        } else {
          throw new Error(`Failed to load container after ${maxRetries} attempts: ${error}`);
        }
      }
    }
    
    // Wait for the "Loading" to disappear
    await page.waitForFunction(() => {
      const loader = document.getElementById('loader');
      return loader && loader.style.display === 'none';
    }, { timeout: 60000 });
    
    // Check if we need to reload for hash change to take effect
    const needsReload = await page.evaluate(() => {
      // Check if the hash exists in the URL and if currentStage3index matches it
      const hash = window.location.hash;
      if (hash && hash.startsWith('#')) {
        const hashId = parseInt(hash.substring(1));
        // Access currentStage3index as a global variable in the page context
        return hashId !== (window as any).currentStage3index;
      }
      return false;
    });
    
    if (needsReload) {
      console.log('Reloading page to apply hash change...');
      await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
      
      // Wait for the container to be visible again
      await page.waitForSelector('#container', { visible: true, timeout: 60000 });
      
      // Wait for the "Loading" to disappear again
      await page.waitForFunction(() => {
        const loader = document.getElementById('loader');
        return loader && loader.style.display === 'none';
      }, { timeout: 60000 });
    }

    // Verify the page has loaded the correct section
    await page.waitForFunction(() => {
      return document.getElementById('thePageTitle') !== null;
    }, { timeout: 30000 }).catch(() => {
      console.log('Warning: Page title element not found.');
    });

    // Wait for the dropdown to be ready
    console.log('Waiting for dropdown menu to be ready...');
    await page.waitForSelector('.ui.dropdown.item', { visible: true, timeout: 30000 });
    
    // Click on the dropdown
    console.log('Clicking on dropdown menu...');
    await page.click('.ui.dropdown.item');
    
    // Wait for dropdown menu to open
    console.log('Waiting for markdown download option to appear...');
    await page.waitForSelector('.menu .item#DEVdownloadMarkdown', { visible: true, timeout: 15000 });
    
    // Get current page title to use in filename
    const pageTitle = await page.evaluate(() => {
      const titleElement = document.getElementById('thePageTitle');
      return titleElement ? titleElement.textContent : '';
    });
    
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
        let newFileName = '';
        
        // Get section number from URL hash
        const sectionNumber = url.includes('#') ? url.split('#').pop() : '1';
        
        if (typeof filenameInfo === 'string') {
          // Legacy case: use the string directly
          newFileName = `${filenameInfo}.md`;
        } else {
          // New format: chapter path-page title-section number
          // Use the actual folder path from URL as the chapter name
          const chapterPath = filenameInfo.chapterPath;
          
          // Use the page title from the DOM, keeping the original characters (including Chinese)
          const pageTitleForFilename = pageTitle || filenameInfo.chapterName;
          
          // Create the filename in the requested format
          newFileName = `${chapterPath}-${pageTitleForFilename}-${sectionNumber}.md`;
          
          // Replace illegal filename characters
          newFileName = newFileName.replace(/[\\/:*?"<>|]/g, '_');
        }
        
        const oldPath = path.join(downloadDir, latestFile);
        const newPath = path.join(downloadDir, newFileName);

        await fs.rename(oldPath, newPath);
        console.log(`Renamed downloaded file to: ${newFileName}`);

        // Download table array using the built-in button
        console.log('Preparing to download table array...');

        // Re-open dropdown in case it closed
        await page.click('.ui.dropdown.item');
        await page.waitForSelector('.menu .item#domDownloadTableArray', { visible: true, timeout: 15000 });
        await page.click('.menu .item#domDownloadTableArray');

        console.log(`Waiting ${waitTimeMs}ms for table download to complete...`);
        await new Promise(resolve => setTimeout(resolve, waitTimeMs));

        // Find downloaded table array file
        const filesAfter = await fs.readdir(downloadDir);
        filesAfter.sort((a,b) => fs.statSync(path.join(downloadDir,b)).mtimeMs - fs.statSync(path.join(downloadDir,a)).mtimeMs);
        const latestTable = filesAfter.find(f => f.endsWith('.json'));
        let tablePath = '';
        if (latestTable) {
          const tableNewName = newFileName.replace(/\.md$/, '-table.json');
          const tableOldPath = path.join(downloadDir, latestTable);
          tablePath = path.join(downloadDir, tableNewName);
          await fs.rename(tableOldPath, tablePath);
          console.log(`Renamed downloaded table array to: ${tableNewName}`);
        }

        // Gather context around tables for insertion
        const tableContext = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('table')).map(t => {
            const before = t.previousElementSibling ? t.previousElementSibling.textContent?.trim().slice(-30) || '' : '';
            const after = t.nextElementSibling ? t.nextElementSibling.textContent?.trim().slice(0,30) || '' : '';
            return { before, after };
          });
        });

        if (tablePath) {
          await insertTablesIntoMarkdown(newPath, tablePath, tableContext);
        }

        // Return true to indicate successful download
        console.log(`Successfully downloaded markdown from: ${url}`);
        return true;
      }
    }
    
    // If we get here but no file was renamed, it might be due to network issues or UI changes
    // Consider it a failed download
    console.log(`No markdown file was found for: ${url}`);
    return false;
  } catch (error) {
    console.error(`Error processing ${url}: ${error}`);
    console.log('Continuing with next page...');
    return false; // Return failure status
  }
}

/** Convert a table's HTML string to Markdown table */
function tableHtmlToMarkdown(html: string): string {
  const dom = new JSDOM(`<table>${html}</table>`);
  const document = dom.window.document;
  const rows = Array.from(document.querySelectorAll('tr')) as HTMLElement[];
  let md = '';
  rows.forEach((row: HTMLElement, rowIndex) => {
    const cells = Array.from(row.querySelectorAll('th,td')) as HTMLElement[];
    const texts = cells.map(c => c.textContent?.trim() || '');
    if (rowIndex === 0) {
      md += `| ${texts.join(' | ')} |\n`;
      md += `| ${cells.map(() => '---').join(' | ')} |\n`;
    } else {
      md += `| ${texts.join(' | ')} |\n`;
    }
  });
  return md;
}

/** Insert Markdown tables into the specified markdown file */
async function insertTablesIntoMarkdown(mdPath: string, tableJsonPath: string, context: {before: string, after: string}[]): Promise<void> {
  try {
    const mdContent = await fs.readFile(mdPath, 'utf-8');
    const tableArray: string[] = await fs.readJson(tableJsonPath);
    const tablesMd = tableArray.map(html => tableHtmlToMarkdown(html));
    let updated = mdContent;
    tablesMd.forEach((table, idx) => {
      const ctx = context[idx] || { before: '', after: '' };
      let pos = -1;
      if (ctx.before) {
        pos = updated.indexOf(ctx.before.trim());
        if (pos !== -1) {
          pos += ctx.before.trim().length;
        }
      }
      if (pos === -1 && ctx.after) {
        pos = updated.indexOf(ctx.after.trim());
      }
      if (pos === -1) {
        updated += `\n\n${table}\n`;
      } else {
        updated = updated.slice(0, pos) + `\n\n${table}\n` + updated.slice(pos);
      }
    });
    await fs.writeFile(mdPath, updated, 'utf-8');
  } catch (err) {
    console.error(`Failed to insert tables into ${mdPath}: ${err}`);
  }
}
