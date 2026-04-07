const VisitPlan = require('../models/VisitPlan');
const FieldVisit = require('../models/FieldVisit');

exports.getPlans = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'EMPLOYEE') filter.employeeId = req.user.id;
    else if (req.user.role === 'MANAGER') filter.assignedBy = req.user.id;

    const { date, employeeId } = req.query;
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }
    if (employeeId && req.user.role !== 'EMPLOYEE') filter.employeeId = employeeId;

    const plans = await VisitPlan.find(filter)
      .populate('employeeId', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName')
      .populate('clients.clientId', 'name contactPerson phone address location priority')
      .sort('-date');
    res.json(plans);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPlan = async (req, res) => {
  try {
    const plan = await VisitPlan.findById(req.params.id)
      .populate('employeeId', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName')
      .populate('clients.clientId', 'name contactPerson phone address location priority');
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPlan = async (req, res) => {
  try {
    const { employeeId, date, clients, instructions } = req.body;

    const plan = await VisitPlan.create({
      employeeId,
      assignedBy: req.user.id,
      date,
      clients,
      instructions
    });

    // Auto-create PLANNED visits for each client in the plan
    const visitDate = new Date(date);
    const visitDocs = clients.map(c => ({
      clientId: c.clientId,
      employeeId,
      visitPlanId: plan._id,
      visitDate,
      status: 'PLANNED'
    }));
    await FieldVisit.insertMany(visitDocs);

    const populated = await VisitPlan.findById(plan._id)
      .populate('employeeId', 'firstName lastName')
      .populate('clients.clientId', 'name contactPerson phone');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePlan = async (req, res) => {
  try {
    const plan = await VisitPlan.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('employeeId', 'firstName lastName')
      .populate('clients.clientId', 'name contactPerson phone');
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    res.json(plan);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deletePlan = async (req, res) => {
  try {
    const plan = await VisitPlan.findByIdAndDelete(req.params.id);
    if (!plan) return res.status(404).json({ message: 'Plan not found' });
    // Remove planned visits linked to this plan
    await FieldVisit.deleteMany({ visitPlanId: req.params.id, status: 'PLANNED' });
    res.json({ message: 'Plan deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMyTodayPlan = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const plan = await VisitPlan.findOne({
      employeeId: req.user.id,
      date: { $gte: start, $lte: end }
    })
      .populate('assignedBy', 'firstName lastName')
      .populate('clients.clientId', 'name contactPerson phone address location priority');
    res.json(plan || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
