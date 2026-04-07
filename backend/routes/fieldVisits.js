const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const {
  getVisits, getVisit, createVisit, checkIn, checkOut,
  uploadPhoto, upload, addRoutePoint, submitOutcome, getTodayVisits, selfReportVisit
} = require('../controllers/fieldVisitController');

router.use(auth);

router.get('/', getVisits);
router.get('/today', getTodayVisits);
router.get('/:id', getVisit);
router.post('/', createVisit);
router.post('/self-report', upload.single('photo'), selfReportVisit);
router.post('/:id/checkin', checkIn);
router.post('/:id/checkout', checkOut);
router.post('/:id/photo', upload.single('photo'), uploadPhoto);
router.post('/:id/route', addRoutePoint);
router.post('/:id/outcome', submitOutcome);

module.exports = router;
