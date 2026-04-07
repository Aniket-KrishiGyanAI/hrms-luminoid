const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getPlans, getPlan, createPlan, updatePlan, deletePlan, getMyTodayPlan
} = require('../controllers/visitPlanController');

router.use(auth);

router.get('/', getPlans);
router.get('/my-today', getMyTodayPlan);
router.get('/:id', getPlan);
router.post('/', authorize('ADMIN', 'HR', 'MANAGER'), createPlan);
router.put('/:id', authorize('ADMIN', 'HR', 'MANAGER'), updatePlan);
router.delete('/:id', authorize('ADMIN', 'HR', 'MANAGER'), deletePlan);

module.exports = router;
