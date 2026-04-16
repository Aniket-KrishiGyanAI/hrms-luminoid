const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { uploadVisitPhoto } = require('../utils/s3Utils');
const {
  getVisits, getVisit, createVisit, checkIn, checkOut,
  uploadPhoto, addRoutePoint, submitOutcome, getTodayVisits, getTodayAllVisits, selfReportVisit, deleteVisit
} = require('../controllers/fieldVisitController');

router.use(auth);

router.get('/', getVisits);
router.get('/today', getTodayVisits);
router.get('/today-all', getTodayAllVisits);
router.get('/:id', getVisit);
router.post('/', createVisit);
router.post('/self-report', uploadVisitPhoto.single('photo'), selfReportVisit);
router.post('/:id/checkin', checkIn);
router.post('/:id/check-in', checkIn);
router.post('/:id/checkout', checkOut);
router.post('/:id/check-out', checkOut);
router.post('/:id/photo', uploadVisitPhoto.single('photo'), uploadPhoto);
router.post('/:id/route', addRoutePoint);
router.post('/:id/outcome', submitOutcome);
router.delete('/:id', deleteVisit);

module.exports = router;
