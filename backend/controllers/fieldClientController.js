const FieldClient = require('../models/FieldClient');

exports.getClients = async (req, res) => {
  try {
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
    res.status(500).json({ message: error.message });
  }
};

exports.getClient = async (req, res) => {
  try {
    const client = await FieldClient.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName');
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createClient = async (req, res) => {
  try {
    const existing = await FieldClient.findOne({
      $or: [
        { phone: req.body.phone },
        { name: { $regex: `^${req.body.name}$`, $options: 'i' } }
      ]
    });
    if (existing) return res.status(409).json({ message: `Duplicate client: a client with the same ${existing.phone === req.body.phone ? 'phone number' : 'name'} already exists.` });
    const client = await FieldClient.create({ ...req.body, createdBy: req.user.id });
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateClient = async (req, res) => {
  try {
    const existing = await FieldClient.findOne({
      _id: { $ne: req.params.id },
      $or: [
        { phone: req.body.phone },
        { name: { $regex: `^${req.body.name}$`, $options: 'i' } }
      ]
    });
    if (existing) return res.status(409).json({ message: `Duplicate client: a client with the same ${existing.phone === req.body.phone ? 'phone number' : 'name'} already exists.` });
    const client = await FieldClient.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteClient = async (req, res) => {
  try {
    const client = await FieldClient.findByIdAndDelete(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.assignClients = async (req, res) => {
  try {
    const { clientIds, employeeId } = req.body;
    await FieldClient.updateMany(
      { _id: { $in: clientIds } },
      { $addToSet: { assignedTo: employeeId } }
    );
    res.json({ message: 'Clients assigned successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
