const path = require('path');
const { execFile } = require('child_process');
const { workerData, parentPort } = require('worker_threads');

const { cwd, env, commandType, outputDir } = workerData;

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';

if (commandType === 'build') {
  const args = [
    'vitepress',
    'build',
    '.',
    '--outDir',
    outputDir,
    '--base',
    '/',
  ];

  console.log(`▶ Running: ${npxCmd} ${args.join(' ')}`);

  execFile(npxCmd, args, { cwd, env }, (error, stdout, stderr) => {
    if (error) {
      parentPort.postMessage(`❌ Error: ${error.message}`);
      process.exit(1);
    }
    if (stderr) {
      parentPort.postMessage(`⚠️ stderr:\n${stderr}`);
    }
    parentPort.postMessage(`✅ stdout:\n${stdout}`);
    process.exit(0);
  });

} else if (commandType === 'install') {
  const npmCmd = isWindows ? 'npm.cmd' : 'npm';
  const args = ['add', '-D', 'vitepress'];

  console.log(`▶ Installing: ${npmCmd} ${args.join(' ')}`);

  execFile(npmCmd, args, { cwd, env }, (error, stdout, stderr) => {
    if (error) {
      parentPort.postMessage(`❌ Error: ${error.message}`);
      process.exit(1);
    }
    if (stderr) {
      parentPort.postMessage(`⚠️ stderr:\n${stderr}`);
    }
    parentPort.postMessage(`✅ stdout:\n${stdout}`);
    process.exit(0);
  });

} else {
  parentPort.postMessage(`❌ Unknown commandType: ${commandType}`);
  process.exit(1);
}
