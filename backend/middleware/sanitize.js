// Middleware to sanitize user input and prevent NoSQL injection
const sanitizeInput = (req, res, next) => {
  // Recursively sanitize objects
  const sanitize = (obj) => {
    if (obj && typeof obj === 'object') {
      for (const key in obj) {
        // Remove keys starting with $ (MongoDB operators)
        if (key.startsWith('$')) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          sanitize(obj[key]);
        }
      }
    }
    return obj;
  };

  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);

  next();
};

module.exports = sanitizeInput;
