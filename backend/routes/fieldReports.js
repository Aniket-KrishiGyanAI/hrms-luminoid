const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getMyReports, getReports, getDailyReport, getTeamSummary
} = require('../controllers/fieldReportController');

router.use(auth);

router.get('/my', getMyReports);
router.get('/team-summary', authorize('ADMIN', 'HR', 'MANAGER'), getTeamSummary);
router.get('/all', authorize('ADMIN', 'HR', 'MANAGER'), getReports);
router.get('/:date/:employeeId', authorize('ADMIN', 'HR', 'MANAGER'), getDailyReport);
router.get('/:date', getDailyReport);

module.exports = router;
