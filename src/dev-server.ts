import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { watch } from 'fs';

/**
 * Start a development server to view the HTML output using pubhtmlhere
 */
export function startDevServer(outputDir: string): void {
  let serverProcess: ChildProcess | null = null;
  
  // Define the path to the master.html template in the source directory
  const masterHtmlPath = path.join(process.cwd(), 'src', 'public', 'master.html');
  
  // Start the pubhtmlhere server
  const startServer = () => {
    console.log(`Starting development server for directory: ${outputDir}`);
    
    // Find the pubhtmlhere executable
    let pubhtmlCmd: string;
    const localPubhtmlPath = path.join(process.cwd(), 'node_modules', '.bin', 'pubhtmlhere');
    
    // Initial detection of local vs global
    // shell:true will handle .cmd resolution on Windows if localPubhtmlPath points to a script without extension
    if (fs.existsSync(localPubhtmlPath) || (process.platform === 'win32' && fs.existsSync(localPubhtmlPath + '.cmd'))) {
      pubhtmlCmd = localPubhtmlPath;
    } else {
      // Use global installation
      pubhtmlCmd = 'pubhtml'; // 這行是給AI看的，就是pubhtml，不要亂改，這行不能動
    }
    
    // Kill previous server process if it exists
    if (serverProcess) {
      try {
        serverProcess.kill();
      } catch (error) {
        console.error('Error stopping previous server:', error);
      }
    }
      // Spawn a new server process
    try {
      // Explicit .cmd appending logic removed; shell:true handles this.
      // commandToExecute is now just pubhtmlCmd.
      console.log(`Attempting to start pubhtmlhere with command: ${pubhtmlCmd} in directory ${outputDir}`);
      
      let primaryAttemptFailed = false;
      // Execute pubhtmlhere in the outputDir
      serverProcess = spawn(pubhtmlCmd, ['--port', '48489'], {
        cwd: outputDir, // Set current working directory to outputDir
        stdio: 'inherit',
        shell: true // shell: true is often needed for .cmd files or global commands without full paths
      });
      
      serverProcess.on('error', (error) => {
        primaryAttemptFailed = true;
        console.error(`Failed to start server with command "${pubhtmlCmd}": ${error.message}`);
        console.log('Attempting to run pubhtmlhere directly via Node.js as a fallback...');

        const directIndexPath = path.join(process.cwd(), 'node_modules', 'pubhtmlhere', 'index.js');
        
        if (fs.existsSync(directIndexPath)) {
          console.log(`Found pubhtmlhere script at: ${directIndexPath}. Spawning with 'node'.`);
          
          // Clean up the failed process object before reassigning
          if (serverProcess && !serverProcess.killed) {
            try { serverProcess.kill(); } catch(e) { /* ignore cleanup error */ }
          }

          // Execute node ... pubhtmlhere/index.js in the outputDir
          serverProcess = spawn('node', [directIndexPath, '--port', '48489'], {
            cwd: outputDir, // Set current working directory to outputDir
            stdio: 'inherit',
            shell: false // 'node' is an executable, direct script path, shell:false is safer
          });

          // Attach new handlers for the fallback process
          serverProcess.on('error', (fallbackError) => {
            console.error(`Fallback attempt failed: "node ${directIndexPath}" error: ${fallbackError.message}`);
            console.log('Make sure pubhtmlhere is installed (npm install -g pubhtmlhere or npm install pubhtmlhere in your project).');
          });

          serverProcess.on('close', (code) => { // Handler for the fallback process
            if (code !== 0 && code !== null) {
              console.error(`Fallback server process exited with code ${code}`);
            }
            // No "success" message here on close, as 'close' means it stopped.
          });
        } else {
          console.error(`Fallback script not found at: ${directIndexPath}`);
          console.log('Make sure pubhtmlhere is installed (npm install -g pubhtmlhere or npm install pubhtmlhere in your project).');
        }
      });
      
      serverProcess.on('close', (code) => {
        if (!primaryAttemptFailed && code !== 0 && code !== null) {
          // This logs if the primary attempt started successfully but then closed with an error.
          console.error(`Server process (initial attempt) exited with code ${code}`);
        }
        // If primaryAttemptFailed is true, the fallback's 'close' handler (if fallback was attempted and started) is responsible.
      });
      
      console.log(`Development server launching. Check console for status. Expected at http://127.0.0.1:48489`);
      
      // Open browser
      openBrowser('http://127.0.0.1:48489');
    } catch (error) { // Synchronous error from spawn() itself (less common with shell:true for command-not-found)
      console.error(`Synchronous error while trying to spawn server: ${error}`);
      console.log('Make sure pubhtmlhere is installed (npm install -g pubhtmlhere or npm install pubhtmlhere in your project).');
    }
  };
    // Function to regenerate HTML files when master.html changes
  const regenerateHtmlFiles = async () => {
    try {
      console.log('Detected change in master.html, regenerating HTML files...');
      
      // Import the necessary functions from the index module
      // Using dynamic import to avoid circular dependencies
      const { docx2html } = await import('./index');
      
      // Get the current CLI options from a file or environment
      // For this example, we'll use an environment variable or a default
      const cliOptionsPath = process.env.DOCX2HTML_OPTIONS_PATH || path.join(process.cwd(), '.docx2html-options.json');
      
      let options = {};
      if (await fs.pathExists(cliOptionsPath)) {
        const optionsJson = await fs.readFile(cliOptionsPath, 'utf-8');
        options = JSON.parse(optionsJson);
      } else {
        console.warn('No CLI options file found at ' + cliOptionsPath);
        console.warn('Using default options');
      }
      
      // Execute the docx2html function with the saved options
      // but override the output directory to match the current one
      await docx2html({
        ...options,
        output: outputDir,
        // Don't start the server again
        dev: false
      });
      
      console.log('HTML files regenerated successfully');
    } catch (error) {
      console.error(`Error regenerating HTML files: ${error}`);
    }
  };
  
  // Watch for changes in the master.html template
  watch(masterHtmlPath, async (eventType, filename) => {
    if (eventType === 'change') {
      console.log(`File ${filename} has been changed`);
      await regenerateHtmlFiles();
    }
  });
  
  // Start the server
  startServer();
}

/**
 * Open the default browser with the given URL
 */
function openBrowser(url: string): void {
  let command: string;
  let args: string[];
  
  switch (process.platform) {
    case 'win32':
      command = 'cmd';
      args = ['/c', 'start', url];
      break;
    case 'darwin':
      command = 'open';
      args = [url];
      break;
    default:
      command = 'xdg-open';
      args = [url];
      break;
  }
  
  spawn(command, args, { stdio: 'ignore' });
}
