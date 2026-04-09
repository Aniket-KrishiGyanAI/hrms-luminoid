const express = require('express');
const { getFolders, createFolder, updateFolder, deleteFolder, archiveFolder, verifyFolderPassword, getFolderFiles, assignFileToFolder } = require('../controllers/folderController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getFolders);
router.post('/', auth, authorize('ADMIN', 'HR'), createFolder);
router.put('/:id', auth, authorize('ADMIN', 'HR'), updateFolder);
router.delete('/:id', auth, authorize('ADMIN', 'HR'), deleteFolder);
router.put('/:id/archive', auth, authorize('ADMIN', 'HR'), archiveFolder);
router.post('/:id/verify-password', auth, verifyFolderPassword);
router.get('/:id/files', auth, getFolderFiles);
router.put('/assign/:fileId', auth, authorize('ADMIN', 'HR'), assignFileToFolder);

module.exports = router;
