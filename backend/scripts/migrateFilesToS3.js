/**
 * Migration Script: Move existing local files to AWS S3
 * 
 * This script migrates:
 * 1. Expense receipts from uploads/receipts/ to S3
 * 2. Field visit photos from uploads/visit-photos/ to S3
 * 
 * Run: node scripts/migrateFilesToS3.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const s3 = require('../config/s3');
const Expense = require('../models/Expense');
const FieldVisit = require('../models/FieldVisit');

const RECEIPTS_DIR = path.join(__dirname, '../uploads/receipts');
const VISIT_PHOTOS_DIR = path.join(__dirname, '../uploads/visit-photos');

// Upload file to S3
const uploadFileToS3 = async (filePath, s3Key, contentType) => {
  try {
    if (!fs.existsSync(filePath)) {
      
      return null;
    }

    const fileContent = fs.readFileSync(filePath);
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: contentType,
      ACL: 'public-read'
    };

    const result = await s3.upload(params).promise();
    
    return result.Location;
  } catch (error) {
    console.error(`❌ Error uploading ${filePath}:`, error.message);
    return null;
  }
};

// Get content type from file extension
const getContentType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.webp': 'image/webp'
  };
  return types[ext] || 'application/octet-stream';
};

// Migrate expense receipts
const migrateExpenseReceipts = async () => {
  
  
  const expenses = await Expense.find({
    $or: [
      { 'bills.0': { $exists: true } },
      { 'receipt.filePath': { $exists: true } }
    ]
  });

  
  
  let successCount = 0;
  let errorCount = 0;

  for (const expense of expenses) {
    try {
      let updated = false;

      // Migrate bills array
      if (expense.bills && expense.bills.length > 0) {
        for (let i = 0; i < expense.bills.length; i++) {
          const bill = expense.bills[i];
          
          // Skip if already migrated (URL contains amazonaws.com)
          if (bill.filePath && bill.filePath.includes('amazonaws.com')) {
            
            continue;
          }

          // Build local file path
          const localPath = path.join(__dirname, '..', bill.filePath);
          const fileName = path.basename(bill.filePath);
          const s3Key = `expense-receipts/${fileName}`;
          const contentType = getContentType(fileName);

          // Upload to S3
          const s3Url = await uploadFileToS3(localPath, s3Key, contentType);
          
          if (s3Url) {
            expense.bills[i].filePath = s3Url;
            expense.bills[i].fileKey = s3Key;
            updated = true;
          } else {
            errorCount++;
          }
        }
      }

      // Migrate legacy receipt field
      if (expense.receipt && expense.receipt.filePath && !expense.receipt.filePath.includes('amazonaws.com')) {
        const localPath = path.join(__dirname, '..', expense.receipt.filePath);
        const fileName = path.basename(expense.receipt.filePath);
        const s3Key = `expense-receipts/${fileName}`;
        const contentType = getContentType(fileName);

        const s3Url = await uploadFileToS3(localPath, s3Key, contentType);
        
        if (s3Url) {
          expense.receipt.filePath = s3Url;
          expense.receipt.fileKey = s3Key;
          updated = true;
        } else {
          errorCount++;
        }
      }

      // Save if updated
      if (updated) {
        await expense.save();
        successCount++;
        
      }
    } catch (error) {
      console.error(`❌ Error processing expense ${expense._id}:`, error.message);
      errorCount++;
    }
  }

  
};

// Migrate field visit photos
const migrateFieldVisitPhotos = async () => {
  
  
  const visits = await FieldVisit.find({
    'photos.0': { $exists: true }
  });

  
  
  let successCount = 0;
  let errorCount = 0;

  for (const visit of visits) {
    try {
      let updated = false;

      if (visit.photos && visit.photos.length > 0) {
        for (let i = 0; i < visit.photos.length; i++) {
          const photo = visit.photos[i];
          
          // Skip if already migrated
          if (photo.url && photo.url.includes('amazonaws.com')) {
            
            continue;
          }

          // Build local file path
          const localPath = path.join(__dirname, '..', photo.url);
          const fileName = path.basename(photo.url);
          const s3Key = `visit-photos/${fileName}`;
          const contentType = getContentType(fileName);

          // Upload to S3
          const s3Url = await uploadFileToS3(localPath, s3Key, contentType);
          
          if (s3Url) {
            visit.photos[i].url = s3Url;
            visit.photos[i].fileKey = s3Key;
            updated = true;
          } else {
            errorCount++;
          }
        }
      }

      // Save if updated
      if (updated) {
        await visit.save();
        successCount++;
        
      }
    } catch (error) {
      console.error(`❌ Error processing visit ${visit._id}:`, error.message);
      errorCount++;
    }
  }

  
};

// Main migration function
const migrate = async () => {
  try {
    
    
    

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    

    // Run migrations
    await migrateExpenseReceipts();
    await migrateFieldVisitPhotos();

    
    
    
    
    
    

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    
  }
};

// Run migration
migrate();
