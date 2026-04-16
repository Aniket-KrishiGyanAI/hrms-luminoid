const getCDNUrl = (filePath) => {
  const cdnUrl = process.env.CDN_URL;
  
  if (!cdnUrl || process.env.NODE_ENV === 'development') {
    // Serve from local server in development
    return filePath.startsWith('/') ? filePath : `/${filePath}`;
  }
  
  // Serve from CDN in production
  const cleanPath = filePath.replace(/^\/+/, '');
  return `${cdnUrl.replace(/\/+$/, '')}/${cleanPath}`;
};

const getAssetUrl = (filename, folder = 'uploads') => {
  const path = `${folder}/${filename}`;
  return getCDNUrl(path);
};

const transformResponseUrls = (data) => {
  if (!data) return data;
  
  const transform = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(transform);
    }
    
    const transformed = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('/uploads/')) {
        transformed[key] = getCDNUrl(value);
      } else if (typeof value === 'object') {
        transformed[key] = transform(value);
      } else {
        transformed[key] = value;
      }
    }
    return transformed;
  };
  
  return transform(data);
};

module.exports = { getCDNUrl, getAssetUrl, transformResponseUrls };
