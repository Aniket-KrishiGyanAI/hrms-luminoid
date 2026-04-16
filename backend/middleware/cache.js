const { getCache, setCache } = require('../config/cache');

const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') return next();

    const key = `cache:${req.originalUrl}:${req.user?.id || 'public'}`;
    
    try {
      const cached = await getCache(key);
      if (cached) {
        return res.json(cached);
      }

      const originalJson = res.json.bind(res);
      res.json = (data) => {
        setCache(key, data, ttl).catch(console.error);
        return originalJson(data);
      };
      
      next();
    } catch (error) {
      next();
    }
  };
};

module.exports = cacheMiddleware;
