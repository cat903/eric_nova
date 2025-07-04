const { Worker } = require('worker_threads');

function spawnWorker(scriptPath, data) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(scriptPath, { workerData: data });

    worker.on('message', (message) => {
      console.log(`Worker finished with message: ${message}`);
      resolve(message);
    });

    worker.on('error', (error) => {
      console.error(`Worker error: ${error}`);
      reject(error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Worker exited with code ${code}`);
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

module.exports = { spawnWorker };
