# Security Implementation Guide

## Overview

This document describes the comprehensive security implementation for the Chatting Apps AI platform, including CORS configuration, rate limiting, security headers, input validation, and sanitization.

## Security Features Implemented

### 1. CORS Configuration (`src/lib/security/config.js`)

**Environment-Specific Settings:**

#### Development Environment
- **Origins:** `http://localhost:3000`, `http://localhost:3001`, `http://127.0.0.1:3000`, `http://127.0.0.1:3001`
- **Methods:** GET, POST, PUT, DELETE, OPTIONS, PATCH
- **Headers:** Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Origin
- **Credentials:** Enabled
- **Max Age:** 86400 seconds (24 hours)

#### Production Environment
- **Origins:** Configured via `ALLOWED_ORIGINS` environment variable or `FRONTEND_URL`/`CLIENT_URL`
- **Methods:** GET, POST, PUT, DELETE, OPTIONS
- **Headers:** Same as development
- **Credentials:** Enabled
- **Max Age:** 3600 seconds (1 hour)

**Configuration:**
```bash
# For production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com
```

### 2. Rate Limiting (`src/lib/security/middleware.js`)

**Three-tier rate limiting system:**

#### General Rate Limiter
- **Window:** 15 minutes
- **Max Requests:** 100 per IP
- **Applies to:** All endpoints except authentication

#### Authentication Rate Limiter
- **Window:** 15 minutes
- **Max Requests:** 5 per IP
- **Applies to:** Login, signup, token refresh
- **Purpose:** Prevents brute force attacks

#### Socket Rate Limiter
- **Window:** 15 minutes
- **Max Connections:** 50 per IP
- **Applies to:** Socket.IO connections
- **Purpose:** Prevents connection flooding

**Headers Added:**
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in window
- `X-RateLimit-Reset`: Timestamp when window resets

### 3. Security Headers (`src/lib/security/middleware.js`)

**Implemented Headers:**

#### Content Security Policy (CSP)
```
default-src 'self'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
script-src 'self' 'unsafe-eval' 'unsafe-inline'
font-src 'self' https://fonts.gstatic.com
img-src 'self' data: https:
connect-src 'self' ws: wss:
media-src 'self'
object-src 'none'
base-uri 'self'
form-action 'self'
```

#### HTTP Strict Transport Security (HSTS) - Production Only
- **Max Age:** 31536000 seconds (1 year)
- **Include Subdomains:** Yes
- **Preload:** Yes

#### Additional Headers
- **X-Content-Type-Options:** nosniff
- **X-Frame-Options:** DENY
- **X-XSS-Protection:** 1; mode=block
- **Referrer-Policy:** strict-origin-when-cross-origin
- **Permissions-Policy:** geolocation=(), microphone=(self), camera=(self)

### 4. Input Validation & Sanitization (`src/lib/security/validation.js`)

**Validation Schemas:**

#### Authentication
- **Email:** Valid format, 3-255 characters
- **Password:** 8-128 characters, requires uppercase, lowercase, and number
- **Username:** 2-50 characters, alphanumeric with spaces, underscores, hyphens

#### Room Operations
- **Room ID:** 3-50 characters, alphanumeric with underscores and hyphens
- **Passcode:** 4-50 characters, alphanumeric only
- **Username:** Same as authentication

#### Messages
- **Content:** 1-5000 characters, trimmed
- **Type:** text, system, file, reaction

#### WebRTC
- **Signal Data:** Valid JSON format
- **Call Type:** audio or video only

**Sanitization Rules:**
- Removes HTML tags (`<`, `>`)
- Trims whitespace
- Limits length to 5000 characters
- Prevents XSS attacks

### 5. Socket.IO Security (`server.js`, `server-integrated.js`)

**Enhanced Configuration:**
- **CORS:** Dynamic origin validation
- **Transports:** WebSocket primary, polling fallback
- **Ping Timeout:** 60 seconds
- **Ping Interval:** 25 seconds
- **Buffer Size:** 1MB maximum

**Authentication:**
- JWT token verification on socket connection
- User session management
- Secure room access control

## Implementation Files

### Security Configuration
- `src/lib/security/config.js` - Main security configuration
- `src/lib/security/middleware.js` - Security middleware implementation
- `src/lib/security/validation.js` - Input validation schemas

### Server Integration
- `server.js` - Standalone server with security middleware
- `server-integrated.js` - Integrated Next.js server with security

### Testing
- `test-security.js` - Comprehensive security test suite

## Environment Variables

**Required for Production:**
```bash
# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
FRONTEND_URL=https://yourdomain.com
CLIENT_URL=https://yourdomain.com

# Security
JWT_SECRET=your-256-bit-secret-key-minimum-32-characters
NODE_ENV=production

# Optional
TRUST_PROXY=1  # For reverse proxy setups
```

**Development Defaults:**
```bash
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
NODE_ENV=development
```

## Usage Examples

### 1. Adding Security Middleware to New Routes

```javascript
const SecurityMiddleware = require('./src/lib/security/middleware');
const security = new SecurityMiddleware();

// Apply to specific route
app.post('/api/endpoint', 
  security.generalRateLimiter,
  security.createValidationMiddleware(ValidationSchemas.yourSchema),
  security.createSanitizationMiddleware(['field1', 'field2']),
  yourHandler
);
```

### 2. Custom Validation Schema

```javascript
const { z } = require('zod');

const customSchema = z.object({
  field: z.string()
    .min(3, 'Minimum 3 characters')
    .max(100, 'Maximum 100 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscores only')
});

app.post('/api/custom',
  security.createValidationMiddleware(customSchema),
  (req, res) => {
    const validatedData = req.validatedData;
    // Use validated and sanitized data
  }
);
```

### 3. Rate Limiting Specific Endpoints

```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'API rate limit exceeded'
});

app.use('/api/', apiLimiter);
```

## Testing Security

### Run Security Tests
```bash
# Start the server first
npm run server

# In another terminal, run security tests
node test-security.js
```

### Manual Security Testing

1. **CORS Test:**
```bash
curl -H "Origin: http://malicious.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS --verbose \
     http://localhost:3001/health
```

2. **Rate Limit Test:**
```bash
for i in {1..10}; do
  curl http://localhost:3001/health
done
```

3. **Security Headers Test:**
```bash
curl -I http://localhost:3001/health
```

## Security Best Practices

### 1. Environment Configuration
- Always set `NODE_ENV=production` in production
- Use strong, unique JWT secrets (minimum 32 characters)
- Configure allowed origins explicitly
- Use HTTPS in production

### 2. Input Handling
- Always validate and sanitize user input
- Use the provided validation schemas
- Sanitize all fields that accept user input
- Limit input length appropriately

### 3. Rate Limiting
- Monitor rate limit headers in client applications
- Implement exponential backoff for retries
- Handle 429 responses gracefully

### 4. CORS
- Never use wildcard origins in production
- Review and update allowed origins regularly
- Test CORS configuration after deployment

### 5. Monitoring
- Review audit logs regularly
- Monitor for unusual rate limiting activity
- Set up alerts for security violations

## Troubleshooting

### CORS Issues

**Problem:** `Origin not allowed by CORS`
**Solution:** Check `ALLOWED_ORIGINS` environment variable and ensure your domain is listed.

### Rate Limiting

**Problem:** `Too many requests`
**Solution:** 
- Check `X-RateLimit-Remaining` header
- Implement request throttling in client
- Increase limits if legitimate traffic is blocked

### Security Headers

**Problem:** Content blocked by CSP
**Solution:** Review browser console for CSP violations and update CSP configuration in `src/lib/security/config.js`.

## Security Checklist

- [ ] Environment variables configured
- [ ] CORS origins properly set
- [ ] Rate limits appropriate for usage
- [ ] Security headers tested
- [ ] Input validation implemented
- [ ] Audit logging enabled
- [ ] HTTPS enforced in production
- [ ] JWT secrets are strong
- [ ] Security tests pass
- [ ] Documentation reviewed

## Additional Resources

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Socket.IO Security](https://socket.io/docs/v4/server-options/#cors)

## Support

For security-related issues or questions:
1. Review this documentation
2. Check the test suite (`test-security.js`)
3. Review configuration files
4. Consult the security middleware implementation

**Important:** Report security vulnerabilities privately rather than in public issues.