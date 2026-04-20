const Folder = require('../models/Folder');
const File = require('../models/File');
const Department = require('../models/Department');
const logger = require('../utils/logger');

const canAccessFolder = (folder, user, userDeptId) => {
  if (['ADMIN', 'HR'].includes(user.role)) return true;
  const v = folder.visibility;
  if (!v || v.type === 'ALL') return true;
  if (v.type === 'ROLES') return v.roles.includes(user.role);
  if (v.type === 'SPECIFIC_EMPLOYEES') return v.employees.map(String).includes(String(user._id));
  if (v.type === 'DEPARTMENTS' && userDeptId)
    return v.departments.map(String).includes(String(userDeptId));
  return false;
};

// Resolve a user's department ObjectId from their department field (may be name string or ObjectId)
const resolveDeptId = async (user) => {
  if (!user.department) return null;
  const mongoose = require('mongoose');
  const val = user.department.toString().trim();
  if (mongoose.Types.ObjectId.isValid(val) && val.length === 24) {
    // Already an ObjectId — verify it exists
    const exists = await Department.findById(val).select('_id').lean();
    if (exists) return exists._id;
  }
  // Stored as a name string — case-insensitive lookup
  const dept = await Department.findOne({ name: { $regex: `^${val}$`, $options: 'i' } }).select('_id').lean();
  return dept ? dept._id : null;
};

const getFolders = async (req, res) => {
  try {
    const userDeptId = await resolveDeptId(req.user);
    const folders = await Folder.find({ isArchived: false })
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    const accessible = folders.filter(f => canAccessFolder(f, req.user, userDeptId));

    // Attach file counts
    const folderIds = accessible.map(f => f._id);
    const counts = await File.aggregate([
      { $match: { folderId: { $in: folderIds } } },
      { $group: { _id: '$folderId', count: { $sum: 1 } } }
    ]);
    const countMap = {};
    counts.forEach(c => { countMap[c._id.toString()] = c.count; });

    const result = accessible.map(f => ({
      ...f.toObject(),
      fileCount: countMap[f._id.toString()] || 0
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createFolder = async (req, res) => {
  try {
    const { name, description, accessType, visibility, color, icon, expiryDate, maxFileSizeMB, allowedFileTypes, isPasswordProtected, folderPassword, tags } = req.body;
    const folder = new Folder({
      name, description,
      accessType: accessType || 'FULL',
      color: color || '#f59e0b',
      icon: icon || 'folder',
      createdBy: req.user.id,
      visibility: visibility || { type: 'ALL', departments: [], roles: [], employees: [] },
      expiryDate: expiryDate || null,
      maxFileSizeMB: maxFileSizeMB || null,
      allowedFileTypes: allowedFileTypes || [],
      isPasswordProtected: isPasswordProtected || false,
      folderPassword: isPasswordProtected ? folderPassword : null,
      tags: tags || []
    });
    await folder.save();
    await folder.populate('createdBy', 'firstName lastName');
    res.status(201).json({ ...folder.toObject(), fileCount: 0 });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateFolder = async (req, res) => {
  try {
    const { folderPassword, isPasswordProtected, ...rest } = req.body;
    const update = { ...rest };
    if (typeof isPasswordProtected !== 'undefined') {
      update.isPasswordProtected = isPasswordProtected;
      update.folderPassword = isPasswordProtected ? folderPassword : null;
    }
    const folder = await Folder.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('createdBy', 'firstName lastName');
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    res.json(folder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteFolder = async (req, res) => {
  try {
    const folder = await Folder.findByIdAndDelete(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    await File.updateMany({ folderId: req.params.id }, { $unset: { folderId: 1 } });
    res.json({ message: 'Folder deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const archiveFolder = async (req, res) => {
  try {
    const folder = await Folder.findByIdAndUpdate(req.params.id, { isArchived: true }, { new: true });
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    res.json({ message: 'Folder archived', folder });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyFolderPassword = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    if (!folder.isPasswordProtected) return res.json({ success: true });
    if (folder.folderPassword !== req.body.password)
      return res.status(403).json({ message: 'Incorrect password' });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getFolderFiles = async (req, res) => {
  try {
    const folder = await Folder.findById(req.params.id);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });
    const userDeptId = await resolveDeptId(req.user);
    if (!canAccessFolder(folder, req.user, userDeptId)) return res.status(403).json({ message: 'Access denied' });

    // Check expiry
    if (folder.expiryDate && new Date() > new Date(folder.expiryDate))
      return res.status(403).json({ message: 'This folder has expired' });

    const files = await File.find({ folderId: req.params.id })
      .populate('uploadedBy', 'firstName lastName email')
      .populate('verifiedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({ folder, files });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const assignFileToFolder = async (req, res) => {
  try {
    const { folderId } = req.body;
    const file = await File.findByIdAndUpdate(req.params.fileId, { folderId: folderId || null }, { new: true });
    if (!file) return res.status(404).json({ message: 'File not found' });
    res.json(file);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { getFolders, createFolder, updateFolder, deleteFolder, archiveFolder, verifyFolderPassword, getFolderFiles, assignFileToFolder };
