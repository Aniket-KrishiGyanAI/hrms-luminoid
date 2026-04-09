const express = require('express');
const router = express.Router();
const { auth, authorize } = require('../middleware/auth');
const {
  getClients, getClient, createClient, updateClient, deleteClient, assignClients
} = require('../controllers/fieldClientController');

router.use(auth);

router.get('/', getClients);
router.get('/:id', getClient);
router.post('/', authorize('ADMIN', 'HR', 'MANAGER'), createClient);
router.put('/:id', authorize('ADMIN', 'HR', 'MANAGER'), updateClient);
router.delete('/:id', authorize('ADMIN', 'HR', 'MANAGER'), deleteClient);
router.post('/assign', authorize('ADMIN', 'HR', 'MANAGER'), assignClients);

module.exports = router;
