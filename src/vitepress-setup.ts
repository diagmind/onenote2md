import fs from 'fs-extra';
import path from 'path';
import { spawn } from 'child_process';
import { Config, ConfigSection } from './types';

/**
 * Function to generate VitePress configuration based on markdown content
 * @param markdownDir Path to the markdown directory
 * @param outputDir Path to output the VitePress config and build result
 */
export async function setupVitePress(markdownDir: string, outputDir: string): Promise<void> {
  console.log('\n=== Starting VitePress setup ===');
  
  try {
    // Create .vitepress directory
    const vitepressDir = path.join(markdownDir, '.vitepress');
    await fs.ensureDir(vitepressDir);
    console.log(`Created VitePress directory: ${vitepressDir}`);
    
    // Copy config from config_example.mts
    const configTemplatePath = path.join(process.cwd(), 'config_example.mts');
    const configTargetPath = path.join(vitepressDir, 'config.mts');
    
    await fs.copy(configTemplatePath, configTargetPath);
    console.log(`Copied config template from ${configTemplatePath} to ${configTargetPath}`);
    
    // Generate sidebar based on markdown files
    const sidebar = await generateSidebar(markdownDir);
    
    // Update the config file with the generated sidebar
    await updateVitepressConfig(configTargetPath, sidebar);
    
    // Create a default index.md file
    await createDefaultIndexFile(markdownDir, sidebar);
    
    // Install VitePress if not already installed
    await installVitepress();
    
    // Build VitePress site
    const vitepressDistDir = path.join(outputDir, 'vitepress_dist');
    await buildVitepress(markdownDir, vitepressDistDir);
    
    console.log(`\n=== VitePress setup completed. Output in: ${vitepressDistDir} ===\n`);
  } catch (error) {
    console.error(`Error setting up VitePress: ${error}`);
    throw error;
  }
}

/**
 * Scan markdown files and generate a sidebar configuration
 */
async function generateSidebar(markdownDir: string): Promise<ConfigSection[]> {
  console.log('Generating sidebar from markdown files...');
  
  // Get list of markdown files
  const files = await fs.readdir(markdownDir);
  const markdownFiles = files.filter(file => file.endsWith('.md'));
  
  // Group files by chapter prefix (e.g., "Appointments", "ChildDepartment")
  const chapters: { [key: string]: Array<{ file: string, title: string }> } = {};
  
  // Process each markdown file
  for (const file of markdownFiles) {
    const filePath = path.join(markdownDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    
    // Extract chapter prefix
    const prefix = file.split('-')[0];
    
    // Extract title from markdown content (usually the first # heading)
    let title = '';
    
    // First try to find an H1 heading
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      title = h1Match[1].trim();
    } else {
      // Extract title from filename if no heading found
      title = file.replace('.md', '');
      const parts = title.split('-');
      
      if (parts.length >= 3) {
        // Format is: Chapter-Section-ID.md
        title = parts.slice(1, -1).join('-');
      } else {
        title = parts.slice(1).join('-');
      }
    }
    
    // Initialize chapter array if it doesn't exist
    if (!chapters[prefix]) {
      chapters[prefix] = [];
    }
    
    // Add file info to appropriate chapter
    chapters[prefix].push({ file, title });
  }
  
  // Create sidebar config
  const sidebar: ConfigSection[] = [];
  
  for (const [chapter, fileInfos] of Object.entries(chapters)) {
    // Sort items by their ID (last part of the filename)
    fileInfos.sort((a, b) => {
      const aIdStr = a.file.split('-').pop()?.replace('.md', '') || '';
      const bIdStr = b.file.split('-').pop()?.replace('.md', '') || '';
      
      const aId = parseInt(aIdStr);
      const bId = parseInt(bIdStr);
      
      if (isNaN(aId) || isNaN(bId)) {
        return a.file.localeCompare(b.file);
      }
      
      return aId - bId;
    });
    
    // Create items for this chapter
    const items = fileInfos.map(({ file, title }) => {
      return {
        text: title,
        link: `/${file}`
      };
    });
    
    // Try to determine chapter display name
    let chapterTitle = chapter;
    
    // If any file has a proper title that starts with the chapter name, use it
    const chapterFile = fileInfos.find(info => 
      info.file.startsWith(chapter) && info.file.split('-')[1] === '');
    
    if (chapterFile) {
      chapterTitle = chapterFile.title;
    }
    
    sidebar.push({
      text: chapterTitle,
      items
    });
  }
  
  console.log(`Generated sidebar with ${sidebar.length} chapters`);
  return sidebar;
}

/**
 * Create a default index.md file in the markdown directory if it doesn't already exist
 */
async function createDefaultIndexFile(markdownDir: string, sidebar: ConfigSection[]): Promise<void> {
  const indexPath = path.join(markdownDir, 'index.md');
  
  // Check if the file already exists
  if (await fs.pathExists(indexPath)) {
    console.log('Index file already exists, skipping creation.');
    return;
  }
  
  console.log('Creating default index.md file...');
  
  // Generate content for the index file
  let content = '# Welcome to the Documentation\n\n';
  content += 'This site contains automatically generated documentation from OneNote.\n\n';
  
  // Add links to each chapter
  content += '## Table of Contents\n\n';
  
  sidebar.forEach(section => {
    content += `### ${section.text}\n\n`;
    
    section.items.forEach(item => {
      // Extract the link without the leading slash
      const link = item.link.startsWith('/') ? item.link.substring(1) : item.link;
      content += `- [${item.text}](${link})\n`;
    });
    
    content += '\n';
  });
  
  // Add a timestamp
  const now = new Date();
  content += `\n\n---\nGenerated on ${now.toISOString().split('T')[0]} at ${now.toTimeString().split(' ')[0]}`;
  
  // Write the file
  await fs.writeFile(indexPath, content);
  console.log('Created index.md file successfully.');
}

/**
 * Update the VitePress config file with the generated sidebar
 */
async function updateVitepressConfig(configPath: string, sidebar: ConfigSection[]): Promise<void> {
  console.log('Updating VitePress config with new sidebar...');
  
  try {
    // Read the existing config file
    let configContent = await fs.readFile(configPath, 'utf8');
    
    // Format sidebar for VitePress config
    // First convert to JSON then make it compatible with JavaScript format
    const sidebarJson = JSON.stringify(sidebar, null, 2)
      .replace(/"([^"]+)":/g, '$1:') // Convert "key": to key:
      .replace(/"/g, '\''); // Convert double quotes to single quotes
    
    // Try different patterns to find where to insert the sidebar
    const patterns = [
      // Pattern 1: Look for existing sidebar array
      { 
        regex: /sidebar:\s*\[[\s\S]*?\],?/m,
        replacement: `sidebar: ${sidebarJson},`
      },
      // Pattern 2: Look for empty sidebar array
      {
        regex: /sidebar:\s*\[\s*\],?/m, 
        replacement: `sidebar: ${sidebarJson},` 
      },
      // Pattern 3: Look for themeConfig object to add sidebar
      {
        regex: /themeConfig:\s*\{/m,
        replacement: `themeConfig: {\n    sidebar: ${sidebarJson},`
      }
    ];
    
    // Try each pattern in order until one works
    let patternFound = false;
    for (const pattern of patterns) {
      if (pattern.regex.test(configContent)) {
        configContent = configContent.replace(pattern.regex, pattern.replacement);
        patternFound = true;
        break;
      }
    }
    
    if (!patternFound) {
      console.warn('Could not find a suitable location in the config file to insert the sidebar. Creating a new themeConfig section.');
      
      // Create a new defineConfig with themeConfig and sidebar
      configContent = `
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'OneNote to Markdown Documentation',
  description: 'Documentation generated from OneNote',
  themeConfig: {
    sidebar: ${sidebarJson}
  }
})
`;
    }
    
    // Write back the updated config
    await fs.writeFile(configPath, configContent);
    console.log('VitePress config updated with new sidebar');
  } catch (error) {
    console.error(`Error updating VitePress config: ${error}`);
    throw error;
  }
}

/**
 * Install VitePress if not already installed
 */
async function installVitepress(): Promise<void> {
  console.log('Installing VitePress and its dependencies...');
  
  return new Promise<void>((resolve, reject) => {
    // Check if VitePress is already installed
    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    
    // Install both vitepress and shiki for syntax highlighting
    const install = spawn(npm, ['install', '--save-dev', 'vitepress', '@shikijs/core']);
    
    install.stdout.on('data', (data) => {
      console.log(`${data}`);
    });
    
    install.stderr.on('data', (data) => {
      console.error(`${data}`);
    });
    
    install.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`VitePress installation failed with code ${code}`));
      } else {
        console.log('VitePress installed successfully');
        resolve();
      }
    });
  });
}

/**
 * Build VitePress site
 */
async function buildVitepress(markdownDir: string, outputDir: string): Promise<void> {
  console.log('Building VitePress site...');
  
  // Create vitepress_dist directory
  const vitepressDistDir = path.join(outputDir, 'vitepress_dist');
  await fs.ensureDir(vitepressDistDir);
  
  // Create dist directory for build output
  await fs.ensureDir(path.join(vitepressDistDir, 'dist'));
  
  return new Promise<void>((resolve, reject) => {
    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      // Run VitePress build command with appropriate options
    // Note: we're passing specific outDir and base options to ensure correct paths
    const build = spawn(npx, [
      'vitepress', 
      'build', 
      markdownDir, 
      '--outDir', vitepressDistDir,
      '--base', '/' // Set the base URL to root
    ], {
      env: {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096' // Increase Node memory limit for large builds
      },
      cwd: process.cwd() // Run from current directory for proper path resolution
    });
    
    build.stdout.on('data', (data) => {
      console.log(`${data}`);
    });
    
    build.stderr.on('data', (data) => {
      console.error(`${data}`);
    });
    
    build.on('close', (code) => {    // No need to clean up any temporary script file
      
      if (code !== 0) {
        reject(new Error(`VitePress build failed with code ${code}`));
      } else {
        console.log(`VitePress build completed, output in: ${vitepressDistDir}`);
        resolve();
      }
    });
  });
}
