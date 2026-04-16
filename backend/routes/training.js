const express = require('express');
const multer = require('multer');
const { getMaterials, createMaterial, updateMaterial, deleteMaterial, downloadMaterial, downloadAdditionalFile, updateProgress, getMaterialProgress, getDepartments, getAnalytics, generateCertificate, uploadCertificate, deleteCertificate, getLeaderboard, getMyStats } = require('../controllers/trainingController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_TRAINING_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/jpg',
  'video/mp4', 'video/webm',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const MAX_TRAINING_FILE_SIZE = 50 * 1024 * 1024; // 50MB for training materials

const ALLOWED_CERTIFICATE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_CERTIFICATE_SIZE = 5 * 1024 * 1024; // 5MB for certificates

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TRAINING_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TRAINING_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, videos, PowerPoint, and Word documents are allowed'));
    }
  }
});

// Configure multer to handle multiple files
const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'files', maxCount: 10 }
]);

const uploadCertificateFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CERTIFICATE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_CERTIFICATE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and images are allowed for certificates'));
    }
  }
}).single('certificate');

router.get('/departments', auth, authorize('ADMIN', 'HR'), getDepartments);
router.get('/analytics', auth, authorize('ADMIN', 'HR'), getAnalytics);
router.get('/leaderboard', auth, getLeaderboard);
router.get('/my-stats', auth, getMyStats);
router.get('/', auth, getMaterials);
router.post('/', auth, authorize('ADMIN', 'HR'), uploadFields, createMaterial);
router.put('/:id', auth, authorize('ADMIN', 'HR'), uploadFields, updateMaterial);
router.delete('/:id', auth, authorize('ADMIN', 'HR'), deleteMaterial);
router.get('/:id/download', auth, downloadMaterial);
router.get('/:id/download-additional/:index', auth, downloadAdditionalFile);
router.get('/:id/certificate', auth, generateCertificate);
router.put('/:id/progress', auth, updateProgress);
router.get('/:id/progress', auth, authorize('ADMIN', 'HR'), getMaterialProgress);
router.post('/:materialId/progress/:userId/certificate', auth, authorize('ADMIN', 'HR', 'MANAGER'), uploadCertificateFile, uploadCertificate);
router.delete('/:materialId/progress/:userId/certificate', auth, authorize('ADMIN', 'HR', 'MANAGER'), deleteCertificate);

module.exports = router;
