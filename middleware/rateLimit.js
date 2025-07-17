const rateLimit = require('express-rate-limit');

// General rate limiting for all endpoints
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for proof generation (computationally expensive)
const proofLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 proof requests per minute
  message: {
    success: false,
    error: 'Too many proof requests, please try again later',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for DID issuance
const didLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 DID requests per hour
  message: {
    success: false,
    error: 'Too many DID requests, please try again later',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for verification requests
const verificationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 verification requests per minute
  message: {
    success: false,
    error: 'Too many verification requests, please try again later',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  proofLimiter,
  didLimiter,
  verificationLimiter
};