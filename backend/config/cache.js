const redis = require('redis');

let client = null;
let isConnected = false;

const initCache = async () => {
  if (!process.env.REDIS_URL) {
    
    return null;
  }

  try {
    client = redis.createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error:', err));
    await client.connect();
    isConnected = true;
    
    return client;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return null;
  }
};

const getCache = async (key) => {
  if (!isConnected || !client) return null;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

const setCache = async (key, value, ttl = 300) => {
  if (!isConnected || !client) return false;
  try {
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Cache set error:', error);
    return false;
  }
};

const delCache = async (key) => {
  if (!isConnected || !client) return false;
  try {
    await client.del(key);
    return true;
  } catch (error) {
    console.error('Cache delete error:', error);
    return false;
  }
};

const clearPattern = async (pattern) => {
  if (!isConnected || !client) return false;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) await client.del(keys);
    return true;
  } catch (error) {
    console.error('Cache clear pattern error:', error);
    return false;
  }
};

module.exports = { initCache, getCache, setCache, delCache, clearPattern };
