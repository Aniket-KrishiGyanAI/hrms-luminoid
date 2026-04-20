const FieldClient = require('../models/FieldClient');
const logger = require('../utils/logger');

exports.getClients = async (req, res) => {
  try {
    logger.info('getClients', { userId: req.user?.id });
    let filter = {};
    if (req.user.role === 'EMPLOYEE') {
      filter.assignedTo = req.user.id;
    }
    const { status, search } = req.query;
    if (status) filter.status = status;
    if (search) filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { contactPerson: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];

    const clients = await FieldClient.find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort('-createdAt');
    res.json(clients);
  } catch (error) {
    logger.error('getClients error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.getClient = async (req, res) => {
  try {
    logger.info('getClient', { userId: req.user?.id });
    const client = await FieldClient.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    logger.error('getClient error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.createClient = async (req, res) => {
  try {
    logger.info('createClient', { userId: req.user?.id });
    const existing = await FieldClient.findOne({
      name: { $regex: `^${req.body.name}$`, $options: 'i' }
    });
    if (existing) return res.status(409).json({ message: 'Duplicate client: a client with the same name already exists.' });
    const client = await FieldClient.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(client);
  } catch (error) {
    logger.error('createClient error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(400).json({ message: error.message });
  }
};

exports.updateClient = async (req, res) => {
  try {
    logger.info('updateClient', { userId: req.user?.id });
    const existing = await FieldClient.findOne({
      _id: { $ne: req.params.id },
      name: { $regex: `^${req.body.name}$`, $options: 'i' }
    });
    if (existing) return res.status(409).json({ message: 'Duplicate client: a client with the same name already exists.' });
    const client = await FieldClient.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    logger.error('updateClient error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(400).json({ message: error.message });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    logger.info('deleteClient', { userId: req.user?.id });
    const client = await FieldClient.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted' });
  } catch (error) {
    logger.error('deleteClient error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(500).json({ message: error.message });
  }
};

exports.assignClients = async (req, res) => {
  try {
    logger.info('assignClients', { userId: req.user?.id });
    const { clientIds, employeeId } = req.body;
    await FieldClient.updateMany(
      { _id: { $in: clientIds } },
      { $addToSet: { assignedTo: employeeId } }
    );
    res.json({ message: 'Clients assigned successfully' });
  } catch (error) {
    logger.error('assignClients error', { error: error.message, stack: error.stack, userId: req.user?.id });

    res.status(400).json({ message: error.message });
  }
};
