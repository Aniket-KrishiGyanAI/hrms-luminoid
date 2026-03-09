const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { createWorkLog, createBulkWorkLog, getMyWorkLogs, getAllWorkLogs, exportWorkLogs, checkTodayLog, updateWorkLog, deleteWorkLog, addComment, getWorkLogById } = require('../controllers/workLogController');

router.post('/', auth, createWorkLog);
router.post('/bulk', auth, createBulkWorkLog);
router.get('/', auth, getMyWorkLogs);
router.get('/all', auth, getAllWorkLogs);
router.get('/export', auth, exportWorkLogs);
router.get('/check-today', auth, checkTodayLog);
router.get('/:id', auth, getWorkLogById);
router.put('/:id', auth, updateWorkLog);
router.delete('/:id', auth, deleteWorkLog);
router.post('/:id/comments', auth, addComment);

module.exports = router;
