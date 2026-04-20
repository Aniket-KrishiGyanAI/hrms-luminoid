const logger = require('./logger');

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    logger.error(`${req.method} ${req.path}`, { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?.id 
    });
    res.status(error.statusCode || 500).json({ 
      message: error.message || 'Server error',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  });
};

module.exports = { asyncHandler };
