const { Worker } = require('worker_threads');
const path = require('path');

const processFileAsync = (filePath, options = {}) => {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'fileWorker.js'), {
      workerData: { filePath, options }
    });

    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
    });
  });
};

const uploadToS3Async = async (file, bucket, key) => {
  const { uploadToS3 } = require('./s3Utils');
  
  // Run in background without blocking
  setImmediate(async () => {
    try {
      await uploadToS3(file, bucket, key);
      
    } catch (error) {
      console.error(`❌ S3 upload failed: ${error.message}`);
    }
  });

  return { status: 'processing', message: 'File upload initiated' };
};

module.exports = { processFileAsync, uploadToS3Async };
