import fs from 'fs-extra';
import path from 'path';
import { execa } from 'execa';
import { ConfigSection } from './types';
import { Worker } from 'worker_threads';

export async function setupVitePress(markdownDir: string, outputDir: string): Promise<void> {
  console.log('\n=== Starting VitePress setup ===');

  try {
    // Rename files with square brackets first
    await renameFilesWithSquareBrackets(markdownDir);

    const vitepressDir = path.join(markdownDir, '.vitepress');
    await fs.ensureDir(vitepressDir);
    console.log(`Created VitePress directory: ${vitepressDir}`);

    const static_P_Dir = path.join(__dirname, 'public');
    const configTemplatePath = path.join(static_P_Dir, 'config_example.mts');
    const configTargetPath = path.join(vitepressDir, 'config.mts');
    await fs.copy(configTemplatePath, configTargetPath);
    console.log(`Copied config template to ${configTargetPath}`);

    const sidebar = await generateSidebar(markdownDir);
    await updateVitepressConfig(configTargetPath, sidebar);
    await createDefaultIndexFile(markdownDir, sidebar);

    console.log(`\n=== VitePress setup completed. Output in: ${outputDir}/vitepress_dist ===\n`);
  } catch (error) {
    console.error('Error setting up VitePress:', error);
    throw error;
  }
}

async function renameFilesWithSquareBrackets(markdownDir: string): Promise<void> {
  console.log('Renaming files with square brackets...');
  const files = await fs.readdir(markdownDir);
  const markdownFiles = files.filter(file => file.endsWith('.md') && (file.includes('[') || file.includes(']')));

  for (const file of markdownFiles) {
    const oldPath = path.join(markdownDir, file);
    const newFilename = file.replace(/\[/g, '【').replace(/\]/g, '】');
    const newPath = path.join(markdownDir, newFilename);
    
    if (oldPath !== newPath) {
      await fs.move(oldPath, newPath);
      console.log(`Renamed: ${file} -> ${newFilename}`);
    }
  }
}

async function generateSidebar(markdownDir: string): Promise<ConfigSection[]> {
  console.log('Generating sidebar...');
  const files = await fs.readdir(markdownDir);
  const markdownFiles = files.filter(file => file.endsWith('.md'));

  const chapters: { [key: string]: Array<{ file: string, title: string }> } = {};
  for (const file of markdownFiles) {
    const filePath = path.join(markdownDir, file);
    const content = await fs.readFile(filePath, 'utf8');
    const prefix = file.split('-')[0];

    let title = '';
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match && h1Match[1]) {
      title = h1Match[1].trim();
    } else {
      title = file.replace('.md', '');
      const parts = title.split('-');
      title = parts.length >= 3 ? parts.slice(1, -1).join('-') : parts.slice(1).join('-');
    }

    chapters[prefix] = chapters[prefix] || [];
    chapters[prefix].push({ file, title });
  }

  const sidebar: ConfigSection[] = [];
  for (const [chapter, files] of Object.entries(chapters)) {
    files.sort((a, b) => {
      const getId = (f: string) => parseInt(f.split('-').pop()?.replace('.md', '') || '', 10);
      return (getId(a.file) || 0) - (getId(b.file) || 0);
    });

    const items = files.map(({ file, title }) => ({
      text: title,
      link: `/${file.replace(/\[/g, '【').replace(/\]/g, '】')}`
    }));

    let chapterTitle = chapter;
    const chapterFile = files.find(f => f.file.startsWith(chapter) && f.file.split('-')[1] === '');
    if (chapterFile) chapterTitle = chapterFile.title;

    sidebar.push({ text: chapterTitle, items });
  }

  return sidebar;
}

async function createDefaultIndexFile(markdownDir: string, sidebar: ConfigSection[]): Promise<void> {
  const indexPath = path.join(markdownDir, 'index.md');
  if (await fs.pathExists(indexPath)) return;

  let content = '# Welcome to the Documentation\n\n';
  content += 'This site contains automatically generated documentation from OneNote.\n\n';
  content += '## Table of Contents\n\n';
  for (const section of sidebar) {
    content += `### ${section.text}\n\n`;
    for (const item of section.items) {
      const link = item.link.replace(/^\//, '');
      content += `- [${item.text}](${link})\n`;
    }
    content += '\n';
  }
  const now = new Date();
  content += `\n\n---\nGenerated on ${now.toISOString().split('T')[0]} at ${now.toTimeString().split(' ')[0]}`;
  await fs.writeFile(indexPath, content);
  console.log('Created index.md');
}

async function updateVitepressConfig(configPath: string, sidebar: ConfigSection[]): Promise<void> {
  console.log('Updating VitePress config...');
  let configContent = await fs.readFile(configPath, 'utf8');

  const sidebarJson = JSON.stringify(sidebar, null, 2)
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/"/g, '\'');

  const patterns = [
    {
      regex: /sidebar:\s*\[[\s\S]*?\],?/m,
      replacement: `sidebar: ${sidebarJson},`
    },
    {
      regex: /sidebar:\s*\[\s*\],?/m,
      replacement: `sidebar: ${sidebarJson},`
    },
    {
      regex: /themeConfig:\s*\{/m,
      replacement: `themeConfig: {\n    sidebar: ${sidebarJson},`
    }
  ];

  let replaced = false;
  for (const pattern of patterns) {
    if (pattern.regex.test(configContent)) {
      configContent = configContent.replace(pattern.regex, pattern.replacement);
      replaced = true;
      break;
    }
  }

  if (!replaced) {
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

  await fs.writeFile(configPath, configContent);
  console.log('VitePress config updated.');
}


