const performanceMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    
    // Log slow requests (>3 seconds) - only in development
    if (duration > 3000 && process.env.NODE_ENV !== 'production') {
      console.warn(`⚠️  SLOW REQUEST: ${method} ${originalUrl} - ${duration}ms - ${statusCode} - ${ip}`);
    }
    
    // Log to performance metrics (can be sent to monitoring service)
    if (process.env.NODE_ENV === 'production') {
      // Send to APM service (New Relic, DataDog, etc.)
      // Example: apm.recordMetric('response_time', duration, { method, path: originalUrl });
    }
  });
  
  next();
};

const getPerformanceStats = () => {
  const used = process.memoryUsage();
  return {
    memory: {
      rss: `${Math.round(used.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(used.external / 1024 / 1024)}MB`
    },
    uptime: `${Math.round(process.uptime())}s`,
    cpu: process.cpuUsage()
  };
};

module.exports = { performanceMonitor, getPerformanceStats };
