const express = require('express');
const multer = require('multer');
const { getFiles, uploadFile, downloadFile, deleteFile, acknowledgeDocument, getAcknowledgments, submitMyDocuments, lockEmployeeDocuments, unlockEmployeeDocuments, verifyDocument, bulkDeleteFiles, getAcknowledgmentCounts } = require('../controllers/fileController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, JPEG, and PNG files are allowed'));
    }
  }
});

router.get('/', auth, getFiles);
router.post('/upload', auth, upload.single('file'), uploadFile);
router.post('/submit-my-documents', auth, submitMyDocuments);
router.post('/bulk-delete', auth, bulkDeleteFiles);
router.get('/acknowledgment-counts', auth, authorize('ADMIN', 'HR'), getAcknowledgmentCounts);
router.get('/download/:id', auth, downloadFile);
router.delete('/:id', auth, deleteFile);
router.post('/:fileId/acknowledge', auth, acknowledgeDocument);
router.get('/:fileId/acknowledgments', auth, authorize('ADMIN', 'HR'), getAcknowledgments);
router.put('/unlock/:employeeId', auth, authorize('ADMIN', 'HR'), unlockEmployeeDocuments);
router.put('/lock/:employeeId', auth, authorize('ADMIN', 'HR'), lockEmployeeDocuments);
router.put('/:fileId/verify', auth, authorize('ADMIN', 'HR'), verifyDocument);

module.exports = router;