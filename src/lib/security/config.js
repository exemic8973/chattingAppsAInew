// Security Configuration
const { z } = require('zod');

const SecurityConfig = {
  cors: {
    development: {
      origins: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'Accept',
        'Origin'
      ],
      credentials: true,
      maxAge: 86400
    },
    production: {
      origins: process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
        : [process.env.FRONTEND_URL || process.env.CLIENT_URL].filter(Boolean),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-CSRF-Token',
        'Accept',
        'Origin'
      ],
      credentials: true,
      maxAge: 3600
    }
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    general: {
      max: 100, // 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    },
    auth: {
      max: 5, // 5 login/signup attempts per windowMs
      message: 'Too many authentication attempts, please try again later.'
    },
    socket: {
      max: 50, // 50 socket connections per windowMs
      message: 'Too many connection attempts, please try again later.'
    }
  },

  securityHeaders: {
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      mediaSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },
    permittedCrossDomainPolicies: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssProtection: true,
    noSniff: true,
    frameguard: { action: 'deny' }
  },

  validation: {
    email: z.string().email().min(3).max(255),
    password: z.string().min(8).max(128),
    userName: z.string().min(2).max(50).regex(/^[a-zA-Z0-9_\s-]+$/),
    roomId: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    message: z.string().min(1).max(5000),
    passcode: z.string().min(4).max(50)
  }
};

module.exports = SecurityConfig;