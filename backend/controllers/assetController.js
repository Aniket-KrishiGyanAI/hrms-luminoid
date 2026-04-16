const Asset = require('../models/Asset');
const logger = require('../utils/logger');

const getAssets = async (req, res) => {
  try {
    const query = req.user.role === 'EMPLOYEE' ? { assignedTo: req.user.id } : {};
    const assets = await Asset.find(query).populate('assignedTo', 'firstName lastName department');
    res.json(assets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createAsset = async (req, res) => {
  try {
    const asset = new Asset(req.body);
    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const assignAsset = async (req, res) => {
  try {
    const { employeeId } = req.body;
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo: employeeId,
        assignedDate: new Date(),
        status: 'ASSIGNED'
      },
      { new: true }
    );
    res.json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const returnAsset = async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo: null,
        returnDate: new Date(),
        status: 'AVAILABLE'
      },
      { new: true }
    );
    res.json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getAssets,
  createAsset,
  assignAsset,
  returnAsset
};