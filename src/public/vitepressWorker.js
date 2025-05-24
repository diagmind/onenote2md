// vitepressWorker.js
const { exec } = require('child_process');
const { workerData, parentPort } = require('worker_threads');

const { command, cwd, env } = workerData;

exec(command, { cwd, env }, (error, stdout, stderr) => {
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
