const Favorite = require('../models/Favorite');
const logger = require('../utils/logger');

const getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find({ userId: req.user.id }).sort({ order: 1 });
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createFavorite = async (req, res) => {
  try {
    const favorite = new Favorite({
      ...req.body,
      userId: req.user.id
    });
    await favorite.save();
    res.status(201).json(favorite);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateFavorite = async (req, res) => {
  try {
    const favorite = await Favorite.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    res.json(favorite);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteFavorite = async (req, res) => {
  try {
    await Favorite.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    res.json({ message: 'Favorite deleted' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getFavorites,
  createFavorite,
  updateFavorite,
  deleteFavorite
};