const TrainingMaterial = require('../models/TrainingMaterial');
const TrainingProgress = require('../models/TrainingProgress');
const Notification = require('../models/Notification');
const User = require('../models/User');
const s3 = require('../config/s3');
const logger = require('../utils/logger');

// GET /api/training — list materials visible to current user
const getMaterials = async (req, res) => {
  try {
    const query = { isActive: true };
    if (req.user.role === 'EMPLOYEE' || req.user.role === 'MANAGER') {
      const orConditions = [
        { targetRoles: { $size: 0 }, targetDepartments: { $size: 0 } }, // no restrictions = visible to all
        { targetRoles: { $in: [req.user.role] } }                        // matches this role
      ];
      // department is stored as a plain string on the user
      if (req.user.department) {
        orConditions.push({ targetDepartments: { $in: [req.user.department] } });
      }
      query.$or = orConditions;
    }
    const materials = await TrainingMaterial.find(query)
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    const ids = materials.map(m => m._id);
    const progresses = await TrainingProgress.find({ userId: req.user._id, materialId: { $in: ids } });
    const progressMap = {};
    progresses.forEach(p => { progressMap[p.materialId.toString()] = p; });

    const result = materials.map(m => ({
      ...m.toObject(),
      progress: progressMap[m._id.toString()] || { status: 'NOT_STARTED' }
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/training — upload new material (HR/ADMIN only)
const createMaterial = async (req, res) => {
  try {
    let s3Key, s3Url, originalName, mimeType, size;
    let thumbnailS3Key, thumbnailUrl;
    let additionalFiles = [];

    // Handle main file upload
    if (req.files && req.files.file && req.files.file[0]) {
      const file = req.files.file[0];
      s3Key = `training/${Date.now()}-${file.originalname}`;
      const s3Result = await s3.upload({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype
      }).promise();
      s3Url = s3Result.Location;
      originalName = file.originalname;
      mimeType = file.mimetype;
      size = file.size;
    }

    // Handle thumbnail upload
    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      const thumbnail = req.files.thumbnail[0];
      thumbnailS3Key = `training/thumbnails/${Date.now()}-${thumbnail.originalname}`;
      const thumbnailResult = await s3.upload({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: thumbnailS3Key,
        Body: thumbnail.buffer,
        ContentType: thumbnail.mimetype
      }).promise();
      thumbnailUrl = thumbnailResult.Location;
    }

    // Handle multiple files upload
    if (req.files && req.files.files && req.files.files.length > 0) {
      for (const file of req.files.files) {
        const fileS3Key = `training/${Date.now()}-${file.originalname}`;
        const fileResult = await s3.upload({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: fileS3Key,
          Body: file.buffer,
          ContentType: file.mimetype
        }).promise();
        
        additionalFiles.push({
          s3Key: fileS3Key,
          s3Url: fileResult.Location,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        });
      }
    }

    const material = new TrainingMaterial({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      externalUrl: req.body.externalUrl,
      targetRoles: req.body.targetRoles ? JSON.parse(req.body.targetRoles) : [],
      targetDepartments: req.body.targetDepartments ? JSON.parse(req.body.targetDepartments) : [],
      isMandatory: req.body.isMandatory === 'true',
      dueDate: req.body.dueDate || null,
      estimatedMinutes: req.body.estimatedMinutes || 0,
      uploadedBy: req.user.id,
      s3Key, s3Url, originalName, mimeType, size,
      thumbnailS3Key, thumbnailUrl,
      additionalFiles
    });

    await material.save();

    // Send notifications to targeted users
    await sendTrainingNotifications(material);

    res.status(201).json(material);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/training/:id — update material (HR/ADMIN only)
const updateMaterial = async (req, res) => {
  try {
    const material = await TrainingMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Not found' });

    // Handle new file upload
    if (req.files && req.files.file && req.files.file[0]) {
      // Delete old file if exists
      if (material.s3Key) {
        await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: material.s3Key }).promise();
      }
      
      const file = req.files.file[0];
      const s3Key = `training/${Date.now()}-${file.originalname}`;
      const s3Result = await s3.upload({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype
      }).promise();
      
      material.s3Key = s3Key;
      material.s3Url = s3Result.Location;
      material.originalName = file.originalname;
      material.mimeType = file.mimetype;
      material.size = file.size;
    }

    // Handle new thumbnail upload
    if (req.files && req.files.thumbnail && req.files.thumbnail[0]) {
      // Delete old thumbnail if exists
      if (material.thumbnailS3Key) {
        await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: material.thumbnailS3Key }).promise();
      }
      
      const thumbnail = req.files.thumbnail[0];
      const thumbnailS3Key = `training/thumbnails/${Date.now()}-${thumbnail.originalname}`;
      const thumbnailResult = await s3.upload({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: thumbnailS3Key,
        Body: thumbnail.buffer,
        ContentType: thumbnail.mimetype
      }).promise();
      
      material.thumbnailS3Key = thumbnailS3Key;
      material.thumbnailUrl = thumbnailResult.Location;
    }

    // Handle multiple files upload
    if (req.files && req.files.files && req.files.files.length > 0) {
      const newFiles = [];
      for (const file of req.files.files) {
        const fileS3Key = `training/${Date.now()}-${file.originalname}`;
        const fileResult = await s3.upload({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: fileS3Key,
          Body: file.buffer,
          ContentType: file.mimetype
        }).promise();
        
        newFiles.push({
          s3Key: fileS3Key,
          s3Url: fileResult.Location,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size
        });
      }
      material.additionalFiles = [...(material.additionalFiles || []), ...newFiles];
    }

    material.title = req.body.title || material.title;
    material.description = req.body.description !== undefined ? req.body.description : material.description;
    material.category = req.body.category !== undefined ? req.body.category : material.category;
    material.externalUrl = req.body.externalUrl !== undefined ? req.body.externalUrl : material.externalUrl;
    material.targetRoles = req.body.targetRoles ? JSON.parse(req.body.targetRoles) : material.targetRoles;
    material.targetDepartments = req.body.targetDepartments ? JSON.parse(req.body.targetDepartments) : material.targetDepartments;
    material.isMandatory = req.body.isMandatory !== undefined ? req.body.isMandatory === 'true' : material.isMandatory;
    material.dueDate = req.body.dueDate !== undefined ? req.body.dueDate : material.dueDate;
    material.estimatedMinutes = req.body.estimatedMinutes !== undefined ? req.body.estimatedMinutes : material.estimatedMinutes;

    await material.save();
    res.json(material);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/training/:id
const deleteMaterial = async (req, res) => {
  try {
    const material = await TrainingMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Not found' });

    // Delete main file
    if (material.s3Key) {
      await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: material.s3Key }).promise();
    }
    
    // Delete thumbnail
    if (material.thumbnailS3Key) {
      await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: material.thumbnailS3Key }).promise();
    }
    
    // Delete additional files
    if (material.additionalFiles && material.additionalFiles.length > 0) {
      for (const file of material.additionalFiles) {
        if (file.s3Key) {
          await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: file.s3Key }).promise();
        }
      }
    }
    
    await TrainingMaterial.findByIdAndDelete(req.params.id);
    await TrainingProgress.deleteMany({ materialId: req.params.id });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/training/:id/download
const downloadMaterial = async (req, res) => {
  try {
    const material = await TrainingMaterial.findById(req.params.id);
    if (!material || !material.s3Key) return res.status(404).json({ message: 'Not found' });
    
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: material.s3Key,
      Expires: 3600
    };
    
    // For preview (video/pdf), use inline content disposition
    if (req.query.preview === 'true' && (material.mimeType?.includes('video') || material.mimeType?.includes('pdf'))) {
      params.ResponseContentDisposition = 'inline';
      params.ResponseContentType = material.mimeType;
    }
    
    const url = s3.getSignedUrl('getObject', params);
    res.json({ downloadUrl: url, fileName: material.originalName, mimeType: material.mimeType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/training/:id/download-additional/:index
const downloadAdditionalFile = async (req, res) => {
  try {
    const material = await TrainingMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Material not found' });
    
    const index = parseInt(req.params.index);
    if (!material.additionalFiles || index < 0 || index >= material.additionalFiles.length) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const file = material.additionalFiles[index];
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.s3Key,
      Expires: 3600
    };
    
    // For preview (video/pdf), use inline content disposition
    if (req.query.preview === 'true' && (file.mimeType?.includes('video') || file.mimeType?.includes('pdf'))) {
      params.ResponseContentDisposition = 'inline';
      params.ResponseContentType = file.mimeType;
    }
    
    const url = s3.getSignedUrl('getObject', params);
    res.json({ downloadUrl: url, fileName: file.originalName, mimeType: file.mimeType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/training/:id/progress — update my progress
const updateProgress = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const update = { status, notes };
    if (status === 'COMPLETED') update.completedAt = new Date();

    const progress = await TrainingProgress.findOneAndUpdate(
      { materialId: req.params.id, userId: req.user._id },
      update,
      { upsert: true, new: true }
    );
    res.json(progress);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/training/:id/progress — get all employees' progress (HR/ADMIN/MANAGER)
const getMaterialProgress = async (req, res) => {
  try {
    const progresses = await TrainingProgress.find({ materialId: req.params.id })
      .populate('userId', 'firstName lastName email department')
      .sort({ updatedAt: -1 });
    
    // Filter out any progress records where userId is null (deleted users)
    const validProgresses = progresses.filter(p => p.userId);
    
    res.json(validProgresses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/training/departments — list unique department names from users
const getDepartments = async (req, res) => {
  try {
    const User = require('../models/User');
    // Get distinct department values (some are strings, some ObjectIds)
    const raw = await User.distinct('department', { isActive: true, department: { $ne: null } });
    const Department = require('../models/Department');
    // Resolve any ObjectId references to names
    const names = await Promise.all(raw.map(async (d) => {
      if (!d) return null;
      const mongoose = require('mongoose');
      if (mongoose.Types.ObjectId.isValid(d) && d.toString().length === 24) {
        const dept = await Department.findById(d).select('name');
        return dept ? dept.name : null;
      }
      return String(d);
    }));
    const unique = [...new Set(names.filter(Boolean))].sort();
    res.json(unique);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/training/analytics — get training analytics (HR/ADMIN)
const getAnalytics = async (req, res) => {
  try {
    const totalMaterials = await TrainingMaterial.countDocuments({ isActive: true });
    const totalProgress = await TrainingProgress.countDocuments();
    const completedProgress = await TrainingProgress.countDocuments({ status: 'COMPLETED' });
    
    const categoryStats = await TrainingMaterial.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const topPerformers = await TrainingProgress.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: '$userId', completedCount: { $sum: 1 } } },
      { $sort: { completedCount: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { firstName: '$user.firstName', lastName: '$user.lastName', completedCount: 1 } }
    ]);

    const overallCompletion = totalProgress > 0 ? Math.round((completedProgress / totalProgress) * 100) : 0;

    res.json({
      totalMaterials,
      overallCompletion,
      categoryStats,
      topPerformers
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/training/leaderboard — get leaderboard (all users)
const getLeaderboard = async (req, res) => {
  try {
    const period = req.query.period || 'month'; // month, week, all
    let dateFilter = {};
    
    if (period === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      dateFilter = { completedAt: { $gte: startOfMonth } };
    } else if (period === 'week') {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      dateFilter = { completedAt: { $gte: startOfWeek } };
    }

    const leaderboard = await TrainingProgress.aggregate([
      { $match: { status: 'COMPLETED', ...dateFilter } },
      { 
        $group: { 
          _id: '$userId', 
          completedCount: { $sum: 1 },
          totalTimeSpent: { $sum: '$timeSpentMinutes' }
        } 
      },
      { $sort: { completedCount: -1, totalTimeSpent: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { 
        $project: { 
          firstName: '$user.firstName', 
          lastName: '$user.lastName',
          email: '$user.email',
          completedCount: 1,
          totalTimeSpent: 1
        } 
      }
    ]);

    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/training/my-stats — get current user's stats
const getMyStats = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Total completed
    const completedCount = await TrainingProgress.countDocuments({ 
      userId, 
      status: 'COMPLETED' 
    });
    
    // Total time spent
    const timeStats = await TrainingProgress.aggregate([
      { $match: { userId: userId } },
      { $group: { _id: null, totalMinutes: { $sum: '$timeSpentMinutes' } } }
    ]);
    const totalTimeSpent = timeStats[0]?.totalMinutes || 0;
    
    // Learning streak
    const completedDates = await TrainingProgress.find({ 
      userId, 
      status: 'COMPLETED' 
    }).sort({ completedAt: -1 }).select('completedAt');
    
    let streak = 0;
    if (completedDates.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < completedDates.length; i++) {
        const date = new Date(completedDates[i].completedAt);
        date.setHours(0, 0, 0, 0);
        
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - streak);
        
        if (date.getTime() === expectedDate.getTime()) {
          streak++;
        } else if (date.getTime() < expectedDate.getTime()) {
          break;
        }
      }
    }
    
    // Achievements
    const achievements = [];
    if (completedCount >= 5) achievements.push({ id: 'first_5', name: 'Getting Started', icon: '🌟', description: 'Completed 5 courses' });
    if (completedCount >= 10) achievements.push({ id: 'first_10', name: 'Learning Enthusiast', icon: '🎯', description: 'Completed 10 courses' });
    if (completedCount >= 20) achievements.push({ id: 'first_20', name: 'Knowledge Seeker', icon: '🏆', description: 'Completed 20 courses' });
    if (completedCount >= 50) achievements.push({ id: 'first_50', name: 'Master Learner', icon: '👑', description: 'Completed 50 courses' });
    if (streak >= 3) achievements.push({ id: 'streak_3', name: 'Consistent Learner', icon: '🔥', description: '3 day streak' });
    if (streak >= 7) achievements.push({ id: 'streak_7', name: 'Week Warrior', icon: '⚡', description: '7 day streak' });
    if (totalTimeSpent >= 300) achievements.push({ id: 'time_5h', name: 'Time Invested', icon: '⏰', description: '5+ hours of learning' });
    
    res.json({
      completedCount,
      totalTimeSpent,
      streak,
      achievements
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/training/:id/certificate — download uploaded certificate only
const generateCertificate = async (req, res) => {
  try {
    const progress = await TrainingProgress.findOne({
      materialId: req.params.id,
      userId: req.user._id,
      status: 'COMPLETED'
    }).populate('materialId').populate('userId');

    if (!progress) return res.status(404).json({ message: 'Training not completed' });

    // Only return certificate if one has been uploaded
    if (progress.certificate?.s3Key) {
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: progress.certificate.s3Key,
        Expires: 3600,
        ResponseContentDisposition: 'attachment'
      };
      const url = s3.getSignedUrl('getObject', params);
      return res.json({ 
        downloadUrl: url, 
        fileName: progress.certificate.originalName,
        isUploaded: true
      });
    }

    // No certificate uploaded
    return res.status(404).json({ message: 'No certificate available for this course' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/training/:materialId/progress/:userId/certificate — upload certificate (HR/ADMIN/MANAGER)
const uploadCertificate = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Certificate file is required' });

    const progress = await TrainingProgress.findOne({
      materialId: req.params.materialId,
      userId: req.params.userId
    });

    if (!progress) return res.status(404).json({ message: 'Progress record not found' });

    // Delete old certificate if exists
    if (progress.certificate?.s3Key) {
      await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: progress.certificate.s3Key }).promise();
    }

    // Upload new certificate
    const s3Key = `training/certificates/${Date.now()}-${req.file.originalname}`;
    const s3Result = await s3.upload({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }).promise();

    progress.certificate = {
      s3Key,
      s3Url: s3Result.Location,
      originalName: req.file.originalname,
      uploadedBy: req.user.id,
      uploadedAt: new Date()
    };

    // Mark as completed if not already
    if (progress.status !== 'COMPLETED') {
      progress.status = 'COMPLETED';
      progress.completedAt = new Date();
    }

    await progress.save();
    res.json({ message: 'Certificate uploaded successfully', progress });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/training/:materialId/progress/:userId/certificate — delete certificate (HR/ADMIN/MANAGER)
const deleteCertificate = async (req, res) => {
  try {
    const progress = await TrainingProgress.findOne({
      materialId: req.params.materialId,
      userId: req.params.userId
    });

    if (!progress) return res.status(404).json({ message: 'Progress record not found' });
    if (!progress.certificate?.s3Key) return res.status(404).json({ message: 'No certificate found' });

    // Delete from S3
    await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: progress.certificate.s3Key }).promise();

    progress.certificate = undefined;
    await progress.save();

    res.json({ message: 'Certificate deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Helper: Send notifications to targeted users
const sendTrainingNotifications = async (material) => {
  try {
    let query = { isActive: true };
    
    if (material.targetRoles.length > 0 || material.targetDepartments.length > 0) {
      const orConditions = [];
      if (material.targetRoles.length > 0) {
        orConditions.push({ role: { $in: material.targetRoles } });
      }
      if (material.targetDepartments.length > 0) {
        orConditions.push({ department: { $in: material.targetDepartments } });
      }
      query.$or = orConditions;
    }

    const users = await User.find(query).select('_id');
    
    const notifications = users.map(user => ({
      userId: user._id,
      title: material.isMandatory ? '🎓 New Mandatory Training' : '📚 New Training Available',
      message: `${material.title}${material.dueDate ? ` - Due: ${new Date(material.dueDate).toLocaleDateString()}` : ''}`,
      type: 'training',
      relatedId: material._id
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }
  } catch (err) {
    console.error('Failed to send training notifications:', err);
  }
};

module.exports = { getMaterials, createMaterial, updateMaterial, deleteMaterial, downloadMaterial, downloadAdditionalFile, updateProgress, getMaterialProgress, getDepartments, getAnalytics, generateCertificate, uploadCertificate, deleteCertificate, getLeaderboard, getMyStats };
