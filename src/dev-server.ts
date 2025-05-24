import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { watch } from 'fs';
import { setupVitePress } from './vitepress-setup';


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
            try { serverProcess.kill(); } catch (e) { /* ignore cleanup error */ }
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

// Store the server process
let serverProcess: ChildProcess | null = null;

/**
 * Start a server programmatically for a specific directory
 * @param outputDir The directory to serve
 * @param port The port to use (default: 48489)
 * @returns A promise that resolves when the server is ready
 */
export async function startServer(outputDir: string, port: number = 48489): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`Starting server for directory: ${outputDir} on port ${port}`);

    // Find the pubhtmlhere executable
    let pubhtmlCmd: string;
    const localPubhtmlPath = path.join(process.cwd(), 'node_modules', '.bin', 'pubhtmlhere');

    // Initial detection of local vs global
    if (fs.existsSync(localPubhtmlPath) || (process.platform === 'win32' && fs.existsSync(localPubhtmlPath + '.cmd'))) {
      pubhtmlCmd = localPubhtmlPath;
    } else {
      // Use global installation
      pubhtmlCmd = 'pubhtml';
    }

    // Kill previous server process if it exists
    if (serverProcess) {
      try {
        serverProcess.kill();

      } catch (error) {
        console.error('Error stopping previous server:', error);
      }
    }

    try {
      console.log(`Starting pubhtmlhere with command: ${pubhtmlCmd} on port ${port}`);

      // Execute pubhtmlhere in the outputDir
      serverProcess = spawn(pubhtmlCmd, ['--port', port.toString()], {
        cwd: outputDir,
        stdio: 'pipe', // Capture output to determine when server is ready
        shell: true
      });

      let errorOutput = '';
      let stdoutOutput = '';

      if (serverProcess.stderr) {
        serverProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
          console.error(`Server stderr: ${data.toString()}`);
        });
      }

      if (serverProcess.stdout) {
        serverProcess.stdout.on('data', (data) => {
          const output = data.toString();
          stdoutOutput += output;
          console.log(output);

          // Detect when server is ready
          if (output.includes('Server running at') || output.includes('Server started')) {
            console.log(`Server started on port ${port}`);
            resolve();
          }
        });
      }

      serverProcess.on('error', (error) => {
        console.error(`Failed to start server: ${error.message}`);

        // Try fallback approach
        const directIndexPath = path.join(process.cwd(), 'node_modules', 'pubhtmlhere', 'index.js');

        if (fs.existsSync(directIndexPath)) {
          console.log(`Using fallback approach with Node.js`);

          if (serverProcess && !serverProcess.killed) {
            try {
              serverProcess.kill();
            } catch (e) { /* ignore */ }
          }

          serverProcess = spawn('node', [directIndexPath, '--port', port.toString()], {
            cwd: outputDir,
            stdio: 'pipe',
            shell: false
          });

          if (serverProcess.stderr) {
            serverProcess.stderr.on('data', (data) => {
              console.error(`Fallback server stderr: ${data.toString()}`);
            });
          }

          if (serverProcess.stdout) {
            serverProcess.stdout.on('data', (data) => {
              const output = data.toString();
              console.log(output);

              if (output.includes('Server running at') || output.includes('Server started')) {
                console.log(`Fallback server started on port ${port}`);
                resolve();
              }
            });
          }

          serverProcess.on('error', (fallbackError) => {
            console.error(`Fallback server failed: ${fallbackError.message}`);
            reject(fallbackError);
          });

          serverProcess.on('close', (code) => {
            if (code !== 0 && code !== null) {
              reject(new Error(`Fallback server process exited with code ${code}`));
            }
          });

        } else {
          reject(new Error(`Failed to start server and fallback not available`));
        }
      });

      serverProcess.on('close', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Server process exited with code ${code}`));
        }
      });

      // Set a timeout to resolve anyway in case we miss the "server started" message
      setTimeout(() => {
        if (stdoutOutput || errorOutput) {
          console.log('Timeout reached but server seems to have started. Proceeding...');
          resolve();
        } else {
          reject(new Error('Server did not start within the timeout period'));
        }
      }, 5000);

    } catch (error) {
      console.error(`Error starting server: ${error}`);
      reject(error);
    }
  });
}

/**
 * Stop the server if it's running
 */
export async function stopServer(): Promise<void> {
  if (serverProcess) {
    console.log('Stopping server...');
    try {
      if (process.platform === 'win32' && serverProcess.pid) {
        // On Windows, use taskkill to forcefully terminate child processes
        spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t'], {
          shell: true,
          stdio: 'ignore'
        });

        // In case taskkill doesn't work, try native kill as a fallback
        try {
          serverProcess.kill('SIGTERM');
        } catch (e) {
          // Ignore errors from the fallback method
        }
      } else {
        // On Unix systems
        serverProcess.kill('SIGTERM');
      }
    } catch (error) {
      console.error(`Error stopping server: ${error}`);

      // Last resort: try to exit the process entirely
      console.log('Server couldn\'t be stopped gracefully. Exiting the process...');
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    }
    serverProcess = null;
  } else {
    console.log('No server process running. Nothing to stop.');

    // If autoMd is enabled but no server process was found,
    // we should exit the process to make sure it doesn't hang
    const cliOptionsPath = process.env.DOCX2HTML_OPTIONS_PATH;
    if (cliOptionsPath) {
      try {
        const options = require(cliOptionsPath);
        if (options.autoMd) {
          console.log('Auto-Markdown mode active. Exiting process...');

          if (options.vitepress) {
            console.log('Setting up VitePress and building the site from markdown files...');
            const outputPath = options.output || './output';
            const markdownDir = path.join(outputPath, 'markdown');
            await setupVitePress(markdownDir, outputPath);
          }

          process.exit(0);
        }
      } catch (e) {
        // If we can't read the options file, just continue
      }
    }
  }
}
