const express = require('express');
const multer = require('multer');
const { getMaterials, createMaterial, deleteMaterial, downloadMaterial, updateProgress, getMaterialProgress, getDepartments } = require('../controllers/trainingController');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/departments', auth, authorize('ADMIN', 'HR'), getDepartments);
router.get('/', auth, getMaterials);
router.post('/', auth, authorize('ADMIN', 'HR'), upload.single('file'), createMaterial);
router.delete('/:id', auth, authorize('ADMIN', 'HR'), deleteMaterial);
router.get('/:id/download', auth, downloadMaterial);
router.put('/:id/progress', auth, updateProgress);
router.get('/:id/progress', auth, authorize('ADMIN', 'HR'), getMaterialProgress);

module.exports = router;
