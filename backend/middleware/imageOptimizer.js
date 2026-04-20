const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;

const imageOptimizer = async (req, res, next) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) {
    return next();
  }

  try {
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();
    const optimizedPath = filePath.replace(ext, '_optimized' + ext);

    await sharp(filePath)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: true })
      .png({ compressionLevel: 9 })
      .toFile(optimizedPath);

    await fs.unlink(filePath);
    await fs.rename(optimizedPath, filePath);

    const stats = await fs.stat(filePath);
    req.file.size = stats.size;

    next();
  } catch (error) {
    console.error('Image optimization error:', error);
    next();
  }
};

module.exports = imageOptimizer;
