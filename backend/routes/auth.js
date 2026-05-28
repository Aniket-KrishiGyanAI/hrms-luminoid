const express = require('express');
const { body } = require('express-validator');
const { register, login, refreshToken, logout, getCurrentUser } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Simple rate limiter for login endpoint only
const loginAttempts = new Map();
const loginRateLimit = (req, res, next) => {
  const key = req.body.email || req.ip;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 20; // 20 attempts per 15 minutes
  
  const attempts = loginAttempts.get(key) || { count: 0, resetTime: now + windowMs };
  
  if (now > attempts.resetTime) {
    attempts.count = 0;
    attempts.resetTime = now + windowMs;
  }
  
  attempts.count++;
  loginAttempts.set(key, attempts);
  
  if (attempts.count > maxAttempts) {
    const retryAfter = Math.ceil((attempts.resetTime - now) / 1000);
    return res.status(429).json({ 
      message: `Too many login attempts. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      retryAfter: retryAfter
    });
  }
  
  next();
};

// Clean up old login attempts every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, attempts] of loginAttempts.entries()) {
    if (now > attempts.resetTime + 60000) {
      loginAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Password validation: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
const passwordValidation = body('password')
  .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
  .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
  .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
  .matches(/[0-9]/).withMessage('Password must contain at least one number')
  .matches(/[@$!%*?&#]/).withMessage('Password must contain at least one special character (@$!%*?&#)');

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  passwordValidation,
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('role').optional().isIn(['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE']),
  body('department').optional().trim(),
  body('designation').optional().trim(),
  body('joinDate').optional().isISO8601(),
  body('dateOfBirth').optional().isISO8601()
], register);

router.post('/login', loginRateLimit, [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required')
], login);

router.post('/refresh', refreshToken);
router.post('/logout', auth, logout);
router.get('/me', auth, getCurrentUser);

module.exports = router;