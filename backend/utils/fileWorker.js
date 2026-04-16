const { parentPort, workerData } = require('worker_threads');
const sharp = require('sharp');
const fs = require('fs').promises;

(async () => {
  try {
    const { filePath, options } = workerData;
    
    if (options.optimize && filePath.match(/\.(jpg|jpeg|png|webp)$/i)) {
      const optimized = await sharp(filePath)
        .resize(options.maxWidth || 1920, options.maxHeight || 1920, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: options.quality || 80 })
        .toBuffer();
      
      await fs.writeFile(filePath, optimized);
      
      parentPort.postMessage({
        success: true,
        filePath,
        size: optimized.length
      });
    } else {
      parentPort.postMessage({ success: true, filePath });
    }
  } catch (error) {
    parentPort.postMessage({ success: false, error: error.message });
  }
})();
