const File = require('../models/File');
const DocumentAcknowledgment = require('../models/DocumentAcknowledgment');
const s3 = require('../config/s3');

const getFiles = async (req, res) => {
  try {
    const { type } = req.query;
    const query = {};
    const mongoose = require('mongoose');

    const isValidObjectId = (val) => val && mongoose.Types.ObjectId.isValid(val);

    if (req.user.role === 'EMPLOYEE') {
      let orConditions = [
        { type: 'ORGANIZATION', 'visibility.type': 'ALL' },
        { type: 'ORGANIZATION', isPublic: true },
        { type: 'ORGANIZATION', 'visibility.type': 'ROLES', 'visibility.roles': req.user.role },
        { type: 'ORGANIZATION', 'visibility.type': 'SPECIFIC_EMPLOYEES', 'visibility.employees': req.user.id },
        { type: 'EMPLOYEE', targetUserId: req.user.id }
      ];
      if (isValidObjectId(req.user.department)) {
        orConditions.push({ type: 'ORGANIZATION', 'visibility.type': 'DEPARTMENTS', 'visibility.departments': req.user.department });
      }
      if (type) orConditions = orConditions.filter(c => c.type === type);
      query.$or = orConditions;
    } else if (req.user.role === 'MANAGER') {
      let orConditions = [
        { type: 'ORGANIZATION', 'visibility.type': 'ALL' },
        { type: 'ORGANIZATION', isPublic: true },
        { type: 'ORGANIZATION', 'visibility.type': 'ROLES', 'visibility.roles': 'MANAGER' },
        { type: 'ORGANIZATION', 'visibility.type': 'SPECIFIC_EMPLOYEES', 'visibility.employees': req.user.id },
        { type: 'EMPLOYEE' }
      ];
      if (isValidObjectId(req.user.department)) {
        orConditions.push({ type: 'ORGANIZATION', 'visibility.type': 'DEPARTMENTS', 'visibility.departments': req.user.department });
      }
      if (type) orConditions = orConditions.filter(c => c.type === type);
      query.$or = orConditions;
    } else {
      if (type) query.type = type;
    }

    const files = await File.find(query)
      .populate('uploadedBy', 'firstName lastName')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Get acknowledgment status for current user
    const fileIds = files.map(f => f._id);
    const acknowledgments = await DocumentAcknowledgment.find({
      fileId: { $in: fileIds },
      userId: req.user.id
    });

    const acknowledgedFileIds = new Set(acknowledgments.map(a => a.fileId.toString()));

    const filesWithAckStatus = files.map(file => ({
      ...file.toObject(),
      isAcknowledged: acknowledgedFileIds.has(file._id.toString())
    }));

    res.json(filesWithAckStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (!req.body.type) {
      return res.status(400).json({ message: 'File type is required' });
    }

    // Employee validation
    if (req.user.role === 'EMPLOYEE') {
      // Employee can only upload EMPLOYEE type for themselves
      if (req.body.type !== 'EMPLOYEE') {
        return res.status(403).json({ message: 'Employees can only upload employee documents' });
      }
      
      // Check if already locked
      const lockedDocs = await File.findOne({ 
        targetUserId: req.user.id, 
        uploadedBy: req.user.id, 
        isLocked: true 
      });
      
      if (lockedDocs) {
        return res.status(403).json({ message: 'Your documents are submitted. Contact HR to reopen.' });
      }
      
      // Validate file type (PDF/JPG/PNG only)
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ message: 'Only PDF, JPG, PNG files allowed' });
      }
      
      // Force targetUserId to be themselves
      req.body.targetUserId = req.user.id;
    }

    const s3Key = `files/${Date.now()}-${req.file.originalname}`;
    
    const uploadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    };

    const s3Result = await s3.upload(uploadParams).promise();

    // Parse visibility from form data
    let visibility = { type: 'ALL', departments: [], roles: [], employees: [] };
    if (req.body.visibility) {
      try { visibility = JSON.parse(req.body.visibility); } catch (e) {}
    }

    const file = new File({
      name: req.body.name || req.file.originalname,
      originalName: req.file.originalname,
      s3Key: s3Key,
      s3Url: s3Result.Location,
      size: req.file.size,
      mimeType: req.file.mimetype,
      type: req.body.type,
      category: req.body.category,
      uploadedBy: req.user.id,
      targetUserId: req.body.targetUserId,
      isPublic: visibility.type === 'ALL',
      visibility,
      description: req.body.description,
      requiresAcknowledgment: req.body.requiresAcknowledgment === 'true',
      folderId: req.body.folderId || null,
      expiryDate: req.body.expiryDate || null
    });

    await file.save();
    res.status(201).json(file);
  } catch (error) {
    console.error('File upload error:', error);
    res.status(400).json({ message: error.message });
  }
};

const downloadFile = async (req, res) => {
  try {
    // console.log('Download request for file ID:', req.params.id);
    
    const file = await File.findById(req.params.id);
    if (!file) {
      // console.log('File not found:', req.params.id);
      return res.status(404).json({ message: 'File not found' });
    }

    // console.log('File found:', file.name, 'S3 Key:', file.s3Key);

    if (req.user.role === 'EMPLOYEE' && file.type === 'EMPLOYEE' && 
        file.targetUserId.toString() !== req.user.id) {
      // console.log('Access denied for user:', req.user.id, 'file target:', file.targetUserId);
      return res.status(403).json({ message: 'Access denied' });
    }

    const downloadParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.s3Key,
      Expires: 3600
    };

    // console.log('Generating signed URL with params:', downloadParams);

    try {
      const signedUrl = s3.getSignedUrl('getObject', downloadParams);
      // console.log('Signed URL generated successfully');
      
      res.json({ downloadUrl: signedUrl, fileName: file.originalName });
    } catch (s3Error) {
      console.error('S3 signed URL error:', s3Error);
      return res.status(500).json({ message: 'Error generating download URL', error: s3Error.message });
    }
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteFile = async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ message: 'File not found' });

    // Employee validation
    if (req.user.role === 'EMPLOYEE') {
      // Check if employee owns the file
      if (file.uploadedBy.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      // Check if document is locked
      if (file.isLocked) {
        return res.status(403).json({ message: 'Cannot delete submitted documents' });
      }
    }

    const deleteParams = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: file.s3Key
    };

    await s3.deleteObject(deleteParams).promise();
    await File.findByIdAndDelete(req.params.id);
    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const acknowledgeDocument = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { comments } = req.body;

    // Check if file exists and user has access
    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Check access permissions
    if (req.user.role === 'EMPLOYEE') {
      if (file.type === 'ORGANIZATION' && !file.isPublic) {
        return res.status(403).json({ message: 'Access denied' });
      }
      if (file.type === 'EMPLOYEE' && file.targetUserId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Create or update acknowledgment
    const acknowledgment = await DocumentAcknowledgment.findOneAndUpdate(
      { fileId, userId: req.user.id },
      { comments, acknowledgedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ message: 'Document acknowledged successfully', acknowledgment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Document already acknowledged' });
    }
    res.status(500).json({ message: error.message });
  }
};

const getAcknowledgments = async (req, res) => {
  try {
    const { fileId } = req.params;
    
    const acknowledgments = await DocumentAcknowledgment.find({ fileId })
      .populate('userId', 'firstName lastName email')
      .sort({ acknowledgedAt: -1 });

    res.json(acknowledgments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//for employeee can add their own documents for only once

const submitMyDocuments = async (req, res) => {
  try {
    const result = await File.updateMany(
      { targetUserId: req.user.id, uploadedBy: req.user.id, isLocked: false },
      { isLocked: true }
    );
    res.json({ message: 'Documents submitted and locked', count: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const lockEmployeeDocuments = async (req, res) => {
  try {
    await File.updateMany(
      { targetUserId: req.params.employeeId, isLocked: false },
      { isLocked: true }
    );
    res.json({ message: 'Documents locked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const unlockEmployeeDocuments = async (req, res) => {
  try {
    const { employeeId } = req.params;
    await File.updateMany(
      { targetUserId: employeeId, isLocked: true },
      { isLocked: false }
    );
    res.json({ message: 'Documents unlocked' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyDocument = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { verificationStatus, expiryDate, verificationNotes } = req.body;

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }

    file.verificationStatus = verificationStatus;
    file.verifiedBy = req.user.id;
    file.verifiedAt = new Date();
    if (expiryDate) file.expiryDate = expiryDate;
    if (verificationNotes) file.verificationNotes = verificationNotes;

    await file.save();
    res.json({ message: 'Document verification updated', file });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const bulkDeleteFiles = async (req, res) => {
  try {
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds) || fileIds.length === 0)
      return res.status(400).json({ message: 'No file IDs provided' });

    const files = await File.find({ _id: { $in: fileIds } });
    for (const file of files) {
      if (req.user.role === 'EMPLOYEE') {
        if (file.uploadedBy.toString() !== req.user.id || file.isLocked)
          return res.status(403).json({ message: 'Access denied on one or more files' });
      }
      await s3.deleteObject({ Bucket: process.env.AWS_S3_BUCKET, Key: file.s3Key }).promise();
    }
    await File.deleteMany({ _id: { $in: fileIds } });
    res.json({ message: `${files.length} files deleted` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAcknowledgmentCounts = async (req, res) => {
  try {
    const { fileIds } = req.query;
    if (!fileIds) return res.json({});
    const mongoose = require('mongoose');
    const ids = fileIds.split(',').map(id => new mongoose.Types.ObjectId(id));
    const counts = await DocumentAcknowledgment.aggregate([
      { $match: { fileId: { $in: ids } } },
      { $group: { _id: '$fileId', count: { $sum: 1 } } }
    ]);
    const result = {};
    counts.forEach(c => { result[c._id.toString()] = c.count; });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getFiles,
  uploadFile,
  downloadFile,
  deleteFile,
  acknowledgeDocument,
  getAcknowledgments,
  submitMyDocuments,
  lockEmployeeDocuments,
  unlockEmployeeDocuments,
  verifyDocument,
  bulkDeleteFiles,
  getAcknowledgmentCounts
};