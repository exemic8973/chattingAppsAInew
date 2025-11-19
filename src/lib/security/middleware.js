const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const SecurityConfig = require('./config');

class SecurityMiddleware {
  constructor() {
    this.config = SecurityConfig;
    this.initializeRateLimiters();
    // Bind methods to preserve 'this' context
    this.setSecurityHeaders = this.setSecurityHeaders.bind(this);
    this.auditLog = this.auditLog.bind(this);
  }

  initializeRateLimiters() {
    this.generalRateLimiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.general.max,
      message: this.config.rateLimit.general.message,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
      },
      skip: (req) => {
        return process.env.NODE_ENV === 'test';
      }
    });

    this.authRateLimiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.auth.max,
      message: this.config.rateLimit.auth.message,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
      },
      skip: (req) => {
        return process.env.NODE_ENV === 'test';
      }
    });

    this.socketRateLimiter = rateLimit({
      windowMs: this.config.rateLimit.windowMs,
      max: this.config.rateLimit.socket.max,
      message: this.config.rateLimit.socket.message,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => {
        return req.ip || req.connection.remoteAddress || 'unknown';
      },
      skip: (req) => {
        return process.env.NODE_ENV === 'test';
      }
    });
  }

  getCorsConfig() {
    const env = process.env.NODE_ENV || 'development';
    const corsConfig = this.config.cors[env] || this.config.cors.development;

    return {
      origin: (origin, callback) => {
        if (!origin) {
          return callback(null, true);
        }

        const allowedOrigins = corsConfig.origins;
        const isAllowed = allowedOrigins.some(allowedOrigin => {
          if (allowedOrigin.includes('*')) {
            const regex = new RegExp(allowedOrigin.replace('*', '.*'));
            return regex.test(origin);
          }
          return allowedOrigin === origin;
        });

        if (isAllowed) {
          callback(null, true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      methods: corsConfig.methods,
      allowedHeaders: corsConfig.allowedHeaders,
      credentials: corsConfig.credentials,
      maxAge: corsConfig.maxAge,
      preflightContinue: false,
      optionsSuccessStatus: 204
    };
  }

  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/[<>]/g, '')
      .trim()
      .substring(0, 5000);
  }

  validateInput(schema, data) {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));
        throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
      }
      throw error;
    }
  }

  createValidationMiddleware(schema) {
    return (req, res, next) => {
      try {
        const data = { ...req.body, ...req.query, ...req.params };
        const validatedData = this.validateInput(schema, data);
        req.validatedData = validatedData;
        next();
      } catch (error) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.message
        });
      }
    };
  }

  createSanitizationMiddleware(fields) {
    return (req, res, next) => {
      if (req.body) {
        fields.forEach(field => {
          if (req.body[field] && typeof req.body[field] === 'string') {
            req.body[field] = this.sanitizeInput(req.body[field]);
          }
        });
      }
      next();
    };
  }

  setSecurityHeaders(req, res, next) {
    const headers = this.config.securityHeaders;

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(self), camera=(self)');

    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', `max-age=${headers.hsts.maxAge}; includeSubDomains; preload`);
    }

    next();
  }

  errorHandler(err, req, res, next) {
    console.error('Security error:', err);

    if (err.name === 'CorsError' || err.message?.includes('not allowed by CORS')) {
      return res.status(403).json({
        error: 'CORS policy violation',
        message: 'Origin not allowed'
      });
    }

    if (err.name === 'RateLimitError' || err.code === 'ECONNRESET') {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: err.message
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  }

  auditLog(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        duration: `${duration}ms`
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('🔒 Security audit:', JSON.stringify(logEntry, null, 2));
      }
    });

    next();
  }
}

module.exports = SecurityMiddleware;