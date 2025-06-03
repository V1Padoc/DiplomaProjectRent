// backend/middleware/cacheMiddleware.js
const cache = require('memory-cache');
const logger = require('../config/logger');

const CACHE_DURATION_SECONDS = 60; // Cache for 60 seconds, adjust as needed

const cacheMiddleware = (duration = CACHE_DURATION_SECONDS) => {
  return (req, res, next) => {
    // Use the originalUrl (path + query string) as the cache key
    // Alternatively, you could build a more specific key based on relevant query params
    const key = '__express__' + (req.originalUrl || req.url);
    const cachedBody = cache.get(key);

    if (cachedBody) {
      logger.info(`Cache hit for key: ${key}`);
      try {
        // memory-cache stores plain strings/objects, if it's JSON, parse it.
        // For safety, assume it might be a stringified JSON.
        res.setHeader('Content-Type', 'application/json'); // Ensure correct content type
        res.send(cachedBody); // If it was stored as a string (e.g. JSON.stringify)
        // If you are sure it was stored as an object: res.json(cachedBody);
      } catch (e) {
        logger.error(`Error sending cached response for ${key}: ${e.message}`);
        // If sending cached response fails, proceed to regenerate it
        cache.del(key); // Remove potentially corrupted cache entry
        next();
      }
      return;
    } else {
      logger.info(`Cache miss for key: ${key}`);
      // If not cached, override res.send to cache the response before sending
      const originalSend = res.send;
      res.send = (body) => {
        // Only cache successful (2xx) responses that are JSON
        if (res.statusCode >= 200 && res.statusCode < 300 && 
            res.getHeader('Content-Type')?.includes('application/json')) {
          try {
            // Ensure body is a string for memory-cache if it's an object
            const bodyToCache = typeof body === 'object' ? JSON.stringify(body) : body;
            cache.put(key, bodyToCache, duration * 1000); // duration is in ms
            logger.info(`Response cached for key: ${key}, duration: ${duration}s`);
          } catch (e) {
            logger.error(`Error caching response for ${key}: ${e.message}`);
          }
        }
        originalSend.call(res, body); // Call the original res.send
      };
      next();
    }
  };
};

module.exports = cacheMiddleware;