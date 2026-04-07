const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  startJourney, endJourney, pauseJourney, resumeJourney, pingLocation, 
  getTodayJourney, getJourneySummary, getJourneyHistory, getActiveJourneys, getJourneyAnalytics
} = require('../controllers/journeyController');

router.use(auth);

router.get('/today', getTodayJourney);
router.get('/history', getJourneyHistory);
router.get('/summary', getJourneySummary);
router.get('/active', getActiveJourneys);
router.get('/analytics', getJourneyAnalytics);
router.get('/:id', auth, async (req, res) => {
  try {
    const journey = await require('../models/Journey').findById(req.params.id)
      .populate('employeeId', 'firstName lastName department phone email');
    if (!journey) return res.status(404).json({ message: 'Journey not found' });
    res.json(journey);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.post('/start', startJourney);
router.post('/pause', pauseJourney);
router.post('/resume', resumeJourney);
router.post('/end', endJourney);
router.post('/ping', pingLocation);
router.delete('/today', async (req, res) => {
  try {
    const moment = require('moment-timezone');
    const Journey = require('../models/Journey');
    const todayStart = moment.tz('Asia/Kolkata').startOf('day').toDate();
    const todayEnd = moment.tz('Asia/Kolkata').endOf('day').toDate();
    
    const result = await Journey.deleteOne({
      employeeId: req.user.id,
      date: { $gte: todayStart, $lte: todayEnd }
    });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'No journey found to delete' });
    }
    
    res.json({ message: 'Journey deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.delete('/:id', authorize('HR', 'ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const Journey = require('../models/Journey');
    const journey = await Journey.findByIdAndDelete(req.params.id);
    
    if (!journey) {
      return res.status(404).json({ message: 'Journey not found' });
    }
    
    res.json({ message: 'Journey deleted successfully', journey });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
