const TrainingMaterial = require('../models/TrainingMaterial');
const TrainingProgress = require('../models/TrainingProgress');
const s3 = require('../config/s3');

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
    const materials = await TrainingMaterial.find(query)
      .populate('uploadedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Attach progress for current user
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

    if (req.file) {
      s3Key = `training/${Date.now()}-${req.file.originalname}`;
      const s3Result = await s3.upload({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype
      }).promise();
      s3Url = s3Result.Location;
      originalName = req.file.originalname;
      mimeType = req.file.mimetype;
      size = req.file.size;
    }

    const material = new TrainingMaterial({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      externalUrl: req.body.externalUrl,
      targetRoles: req.body.targetRoles ? JSON.parse(req.body.targetRoles) : [],
      targetDepartments: req.body.targetDepartments ? JSON.parse(req.body.targetDepartments) : [],
      uploadedBy: req.user.id,
      s3Key, s3Url, originalName, mimeType, size
    });

    await material.save();
    res.status(201).json(material);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/training/:id
const deleteMaterial = async (req, res) => {
  try {
    const material = await TrainingMaterial.findById(req.params.id);
    if (!material) return res.status(404).json({ message: 'Not found' });

    if (material.s3Key) {
      await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: material.s3Key }).promise();
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
    const url = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: material.s3Key,
      Expires: 3600
    });
    res.json({ downloadUrl: url, fileName: material.originalName });
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

// GET /api/training/:id/progress — get all employees' progress (HR/ADMIN)
const getMaterialProgress = async (req, res) => {
  try {
    const progresses = await TrainingProgress.find({ materialId: req.params.id })
      .populate('userId', 'firstName lastName email department')
      .sort({ updatedAt: -1 });
    res.json(progresses);
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

module.exports = { getMaterials, createMaterial, deleteMaterial, downloadMaterial, updateProgress, getMaterialProgress, getDepartments };
