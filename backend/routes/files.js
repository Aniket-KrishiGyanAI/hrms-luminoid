const express = require('express');
const multer = require('multer');
const { getFiles, uploadFile, downloadFile, deleteFile, acknowledgeDocument, getAcknowledgments, submitMyDocuments, lockEmployeeDocuments, unlockEmployeeDocuments, verifyDocument, bulkDeleteFiles, getAcknowledgmentCounts } = require('../controllers/fileController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

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