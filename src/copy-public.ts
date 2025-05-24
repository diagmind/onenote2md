import fs from 'fs-extra';
import path from 'path';

/**
 * Copy public directory to dist folder
 */
async function copyPublicDir(a:string) {
  try {
    const sourceDir = path.resolve(__dirname, '..', 'src', a);
    const destDir = path.resolve(__dirname, a);
    
    console.log(`Copying public directory from ${sourceDir} to ${destDir}`);
    await fs.copy(sourceDir, destDir);
    console.log('Public directory copied successfully');
  } catch (error) {
    console.error(`Error copying public directory: ${error}`);
    process.exit(1);
  }
}

// Execute the function
copyPublicDir("public");
copyPublicDir("static");
console.log("*************************************************Copy public and static directories completed successfully.");