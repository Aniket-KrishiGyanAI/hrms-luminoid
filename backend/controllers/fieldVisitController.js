const FieldVisit = require('../models/FieldVisit');
const FieldReport = require('../models/FieldReport');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Setup upload directory
const visitPhotosDir = path.join(__dirname, '../uploads/visit-photos');
if (!fs.existsSync(visitPhotosDir)) fs.mkdirSync(visitPhotosDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, visitPhotosDir),
  filename: (req, file, cb) => cb(null, `visit-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`)
});

exports.upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images allowed'));
  }
});

// Haversine distance in km
const haversine = (p1, p2) => {
  const R = 6371;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const calcTotalDistance = (points) => {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]);
  return Math.round(total * 100) / 100;
};

exports.getVisits = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'EMPLOYEE') filter.employeeId = req.user.id;
    else if (req.user.role === 'MANAGER') {
      const User = require('../models/User');
      const team = await User.find({ managerId: req.user.id }).select('_id');
      filter.employeeId = { $in: team.map(u => u._id) };
    }

    const { date, employeeId, status } = req.query;
    if (employeeId && req.user.role !== 'EMPLOYEE') filter.employeeId = employeeId;
    if (status) filter.status = status;
    if (date) {
      const start = new Date(date); start.setHours(0, 0, 0, 0);
      const end = new Date(date); end.setHours(23, 59, 59, 999);
      filter.visitDate = { $gte: start, $lte: end };
    }

    const visits = await FieldVisit.find(filter)
      .populate('clientId', 'name contactPerson phone address location')
      .populate('employeeId', 'firstName lastName')
      .sort('-visitDate');
    res.json(visits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getVisit = async (req, res) => {
  try {
    const visit = await FieldVisit.findById(req.params.id)
      .populate('clientId', 'name contactPerson phone address location')
      .populate('employeeId', 'firstName lastName')
      .populate('visitPlanId');
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    res.json(visit);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createVisit = async (req, res) => {
  try {
    const visit = await FieldVisit.create({ ...req.body, employeeId: req.user.id });
    res.status(201).json(visit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.checkIn = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;
    const visit = await FieldVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    if (visit.employeeId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (visit.status !== 'PLANNED') return res.status(400).json({ message: 'Visit already checked in or completed' });

    visit.checkIn = { time: new Date(), location: { lat, lng, address } };
    visit.status = 'CHECKED_IN';
    visit.routePoints.push({ lat, lng, timestamp: new Date() });
    await visit.save();
    res.json(visit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;
    const visit = await FieldVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    if (visit.employeeId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (visit.status !== 'CHECKED_IN') return res.status(400).json({ message: 'Must check in first' });

    visit.routePoints.push({ lat, lng, timestamp: new Date() });
    visit.checkOut = { time: new Date(), location: { lat, lng, address } };
    visit.status = 'COMPLETED';
    visit.totalDistanceKm = calcTotalDistance(visit.routePoints);
    if (visit.checkIn?.time) {
      visit.durationMinutes = Math.round((new Date() - visit.checkIn.time) / 60000);
    }
    await visit.save();
    res.json(visit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;
    const visit = await FieldVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    if (visit.employeeId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (!req.file) return res.status(400).json({ message: 'No photo uploaded' });

    visit.photos.push({
      url: `/uploads/visit-photos/${req.file.filename}`,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      address,
      capturedAt: new Date()
    });
    await visit.save();
    res.json({ message: 'Photo uploaded', photos: visit.photos });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.addRoutePoint = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const visit = await FieldVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    if (visit.employeeId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });
    if (visit.status !== 'CHECKED_IN') return res.status(400).json({ message: 'Visit not active' });

    visit.routePoints.push({ lat, lng, timestamp: new Date() });
    await visit.save();
    res.json({ message: 'Route point added', totalPoints: visit.routePoints.length });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.submitOutcome = async (req, res) => {
  try {
    const visit = await FieldVisit.findById(req.params.id);
    if (!visit) return res.status(404).json({ message: 'Visit not found' });
    if (visit.employeeId.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorized' });

    const { personMet, phone, purposeOfVisit, ...outcomeData } = req.body;
    
    visit.outcome = { ...visit.outcome, ...outcomeData };
    if (personMet) visit.personMet = personMet;
    if (phone) visit.phone = phone;
    if (purposeOfVisit) visit.purposeOfVisit = purposeOfVisit;
    
    await visit.save();
    res.json(visit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.selfReportVisit = async (req, res) => {
  try {
    const { clientName, personMet, phone, purposeOfVisit, notes, outcome, dealValue, lat, lng, address } = req.body;
    if (!clientName) return res.status(400).json({ message: 'Client name is required' });

    // Find or create an ad-hoc FieldClient entry
    const FieldClient = require('../models/FieldClient');
    let client = await FieldClient.findOne({ name: clientName, createdBy: req.user.id });
    if (!client) {
      client = await FieldClient.create({
        name: clientName,
        contactPerson: personMet || 'Self-reported',
        phone: phone || '-',
        address: address || 'Self-reported',
        status: 'PROSPECT',
        priority: 'MEDIUM',
        createdBy: req.user.id
      });
    }

    const now = new Date();
    const visitData = {
      clientId: client._id,
      employeeId: req.user.id,
      visitDate: now,
      selfReported: true,
      personMet,
      phone,
      purposeOfVisit,
      selfReportNote: notes,
      checkIn: { time: now, location: { lat: parseFloat(lat) || null, lng: parseFloat(lng) || null, address } },
      checkOut: { time: now, location: { lat: parseFloat(lat) || null, lng: parseFloat(lng) || null, address } },
      status: 'COMPLETED',
      outcome: { status: outcome || 'NEUTRAL', notes, dealValue: parseFloat(dealValue) || 0 },
      routePoints: lat ? [{ lat: parseFloat(lat), lng: parseFloat(lng), timestamp: now }] : []
    };

    const visit = await FieldVisit.create(visitData);

    if (req.file) {
      visit.photos.push({
        url: `/uploads/visit-photos/${req.file.filename}`,
        lat: parseFloat(lat) || null,
        lng: parseFloat(lng) || null,
        address,
        capturedAt: now
      });
      await visit.save();
    }

    res.status(201).json(visit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.getTodayVisits = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const visits = await FieldVisit.find({
      employeeId: req.user.id,
      visitDate: { $gte: start, $lte: end }
    }).populate('clientId', 'name contactPerson phone address location priority');
    res.json(visits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
