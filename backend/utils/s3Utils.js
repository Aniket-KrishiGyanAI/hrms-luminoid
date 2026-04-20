const s3 = require('../config/s3');
const multer = require('multer');
const path = require('path');

// Configure multer for memory storage (profile images)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Configure multer for expense receipts (memory storage for S3)
const uploadReceipt = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
    const allowedExts = /\.(jpeg|jpg|png|pdf)$/i;
    
    if (allowedMimes.includes(file.mimetype) && allowedExts.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and PDF files are allowed'), false);
    }
  }
});

// Configure multer for field visit photos (memory storage for S3)
const uploadVisitPhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
  }
});

// Generic S3 upload function
const uploadToS3 = async (file, folder, customFileName = null) => {
  try {
    const fileName = customFileName || `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    const key = `${folder}/${fileName}`;
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype
      // Removed ACL parameter - bucket uses bucket policy for public access
    };

    const result = await s3.upload(params).promise();
    return {
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket
    };
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

// Upload profile image to S3
const uploadProfileImage = async (file, userId) => {
  const fileName = `${userId}-${Date.now()}.${file.originalname.split('.').pop()}`;
  const result = await uploadToS3(file, 'profile-images', fileName);
  return result.url;
};

// Upload expense receipt to S3
const uploadExpenseReceipt = async (file, employeeId) => {
  const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileName = `receipt-${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}`;
  const result = await uploadToS3(file, 'expense-receipts', fileName);
  return result;
};

// Upload field visit photo to S3
const uploadVisitPhotoToS3 = async (file, employeeId) => {
  const fileName = `visit-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
  const result = await uploadToS3(file, 'visit-photos', fileName);
  return result;
};

// Delete file from S3 by URL
const deleteFromS3 = async (fileUrl) => {
  if (!fileUrl) return;
  
  try {
    // Extract key from URL
    let key;
    if (fileUrl.includes('amazonaws.com/')) {
      // Full S3 URL
      key = fileUrl.split('amazonaws.com/')[1];
    } else if (fileUrl.startsWith('http')) {
      // Other URL format
      const urlParts = fileUrl.split('/');
      key = urlParts.slice(-2).join('/');
    } else {
      // Already a key
      key = fileUrl;
    }
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key
    };

    await s3.deleteObject(params).promise();
    
  } catch (error) {
    console.error('Error deleting from S3:', error);
  }
};

// Delete profile image from S3
const deleteProfileImage = async (imageUrl) => {
  await deleteFromS3(imageUrl);
};

// Delete expense receipt from S3
const deleteExpenseReceipt = async (receiptUrl) => {
  await deleteFromS3(receiptUrl);
};

// Delete visit photo from S3
const deleteVisitPhoto = async (photoUrl) => {
  await deleteFromS3(photoUrl);
};

module.exports = {
  upload,
  uploadReceipt,
  uploadVisitPhoto,
  uploadToS3,
  uploadProfileImage,
  uploadExpenseReceipt,
  uploadVisitPhotoToS3,
  deleteFromS3,
  deleteProfileImage,
  deleteExpenseReceipt,
  deleteVisitPhoto
};