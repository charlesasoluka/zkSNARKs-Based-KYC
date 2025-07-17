const NodeCache = require('node-cache');

// Create cache instances with different TTL values
const responseCache = new NodeCache({ 
  stdTTL: 300, // 5 minutes default
  checkperiod: 60 // check for expired keys every 60 seconds
});

const merkleCache = new NodeCache({ 
  stdTTL: 60, // 1 minute for merkle root
  checkperiod: 30 
});

const serviceCache = new NodeCache({ 
  stdTTL: 3600, // 1 hour for service configuration
  checkperiod: 300 
});

// Generic cache middleware factory
const cacheMiddleware = (cache, keyGenerator, ttl) => {
  return (req, res, next) => {
    const key = keyGenerator(req);
    const cached = cache.get(key);
    
    if (cached) {
      console.log(`Cache hit for key: ${key}`);
      return res.json(cached);
    }
    
    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to cache the response
    res.json = function(data) {
      if (data && data.success) {
        cache.set(key, data, ttl);
        console.log(`Cached response for key: ${key}`);
      }
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Specific cache middlewares
const cacheMerkleRoot = cacheMiddleware(
  merkleCache,
  () => 'merkle_root',
  60 // 1 minute
);

const cacheServices = cacheMiddleware(
  serviceCache,
  () => 'services',
  3600 // 1 hour
);

const cacheHealthCheck = cacheMiddleware(
  responseCache,
  (req) => `health_${req.baseUrl}`,
  30 // 30 seconds
);

const cacheStats = cacheMiddleware(
  responseCache,
  () => 'admin_stats',
  300 // 5 minutes
);

// Cache user access status
const cacheUserAccess = cacheMiddleware(
  responseCache,
  (req) => `access_${req.params.userAddress}_${req.params.service}`,
  60 // 1 minute
);

// Function to clear specific cache entries
const clearCache = (pattern) => {
  const keys = responseCache.keys();
  keys.forEach(key => {
    if (key.includes(pattern)) {
      responseCache.del(key);
    }
  });
};

// Clear cache when access is granted or revoked
const clearUserAccessCache = (userAddress, service) => {
  const key = `access_${userAddress}_${service}`;
  responseCache.del(key);
  console.log(`Cleared cache for key: ${key}`);
};

module.exports = {
  responseCache,
  merkleCache,
  serviceCache,
  cacheMerkleRoot,
  cacheServices,
  cacheHealthCheck,
  cacheStats,
  cacheUserAccess,
  clearCache,
  clearUserAccessCache
};