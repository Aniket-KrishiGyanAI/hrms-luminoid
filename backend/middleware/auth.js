const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { checkUserPermission } = require('../controllers/permissionController');
const tokenBlacklist = require('../utils/tokenBlacklist');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    // Check if token is blacklisted
    if (tokenBlacklist.isBlacklisted(token)) {
      return res.status(401).json({ message: 'Token has been revoked.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshToken');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token or user inactive.' });
    }

    req.user = user;
    req.token = token; // Store token for logout
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

const requirePermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Access denied. User not authenticated.' });
      }

      const hasPermission = await checkUserPermission(req.user.id, resource, action);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied. Missing permission: ${action} ${resource}` 
        });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: 'Permission check failed', error: error.message });
    }
  };
};

module.exports = { auth, authorize, requirePermission };