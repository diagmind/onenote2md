#!/usr/bin/env node

// Simple test script to demonstrate docx2html functionality
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the directory of this script
const scriptDir = __dirname;

// Path to the sample config
const sampleConfigPath = path.join(scriptDir, 'sample-config.json');

// Check if sample config exists
if (!fs.existsSync(sampleConfigPath)) {
  console.error('Error: sample-config.json not found');
  process.exit(1);
}

// Create some sample DOCX files for testing if they don't exist
const sampleDocsDir = path.join(scriptDir, 'sample-docs');
if (!fs.existsSync(sampleDocsDir)) {
  fs.mkdirSync(sampleDocsDir, { recursive: true });
}

// Create empty DOCX files for testing (just stubs)
['內科.docx', '外科.docx', '婦產科.docx'].forEach(docName => {
  const docPath = path.join(sampleDocsDir, docName);
  if (!fs.existsSync(docPath)) {
    // Just create an empty file for demonstration
    fs.writeFileSync(docPath, '');
    console.log(`Created sample file: ${docPath}`);
  }
});

// Run the docx2html command
console.log('Running docx2html test...');
try {
  const command = `node ${path.join(scriptDir, 'dist', 'cli.js')} -b "${sampleConfigPath}" -s local -o "${path.join(scriptDir, 'test-output')}" -w -e`;
  console.log(`Executing: ${command}`);
  
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  console.error('Error running docx2html:', error);
  process.exit(1);
}
