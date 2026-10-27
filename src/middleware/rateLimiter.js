/**
 * IEI TVLC Defensive Security: In-Memory Sliding-Window Rate Limiter
 * Protects against brute-force attacks, credential stuffing, and API flooding.
 */

const hitMap = new Map();

// Periodic cleanup of expired rate-limit buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of hitMap.entries()) {
    if (now > record.resetTime) {
      hitMap.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Creates rate-limiting middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default 15 minutes)
 * @param {number} options.max - Max allowed requests per window
 * @param {string} options.message - Error message when exceeded
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const max = options.max || 100;
  const message = options.message || 'Too many requests from this IP address. Please try again later.';

  return (req, res, next) => {
    // Determine client identifier safely
    let clientIp = '127.0.0.1';
    if (req.headers && req.headers['x-forwarded-for']) {
      clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
    } else if (req.socket && req.socket.remoteAddress) {
      clientIp = req.socket.remoteAddress;
    } else if (req.connection && req.connection.remoteAddress) {
      clientIp = req.connection.remoteAddress;
    }

    const key = `${req.baseUrl || ''}${req.path}:${clientIp}`;
    const now = Date.now();

    let record = hitMap.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs
      };
      hitMap.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        success: false,
        error: message,
        retryAfter: `${retryAfterSec} seconds`
      });
    }

    req.rateLimitReset = () => {
      hitMap.delete(key);
    };

    next();
  };
}

// Pre-configured rate limiters
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 attempts per 15 mins to prevent credential stuffing
  message: 'Too many authentication attempts from this IP. Please wait 15 minutes before retrying.'
});

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 requests/minute
  message: 'API rate limit exceeded. Please throttle your requests.'
});

module.exports = {
  createRateLimiter,
  authLimiter,
  apiLimiter
};
