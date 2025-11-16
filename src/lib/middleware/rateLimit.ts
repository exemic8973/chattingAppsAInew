/**
 * Rate limiting middleware for API endpoints
 * Protects against brute force attacks and abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { RateLimitError } from '@/lib/errors/ApiError';
import { ApiResponse, getCorrelationId } from '@/lib/api/response';
import { config } from '@/lib/config';

/**
 * Rate limiter storage interface
 */
interface RateLimitStore {
  get(key: string): Promise<RateLimitInfo | null>;
  set(key: string, info: RateLimitInfo, ttl: number): Promise<void>;
  increment(key: string, windowMs: number): Promise<RateLimitInfo>;
  reset(key: string): Promise<void>;
}

/**
 * Rate limit information
 */
interface RateLimitInfo {
  count: number;
  resetTime: number;
  windowMs: number;
}

/**
 * In-memory rate limiter store (for development/single instance)
 */
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, RateLimitInfo>();

  async get(key: string): Promise<RateLimitInfo | null> {
    const info = this.store.get(key);
    if (info && info.resetTime < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return info || null;
  }

  async set(key: string, info: RateLimitInfo, ttl: number): Promise<void> {
    this.store.set(key, info);
    // Auto-cleanup after TTL
    setTimeout(() => this.store.delete(key), ttl);
  }

  async increment(key: string, windowMs: number): Promise<RateLimitInfo> {
    const now = Date.now();
    const resetTime = now + windowMs;
    
    const existing = await this.get(key);
    const info: RateLimitInfo = existing 
      ? { ...existing, count: existing.count + 1 }
      : { count: 1, resetTime, windowMs };
    
    await this.set(key, info, windowMs);
    return info;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  windowMs: number;      // Time window in milliseconds
  max: number;           // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean;     // Don't count failed requests
  message?: string;      // Custom error message
  store?: RateLimitStore; // Custom store implementation
}

/**
 * Rate limiter middleware
 */
export class RateLimiter {
  private store: RateLimitStore;
  private config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.store = config.store || new MemoryRateLimitStore();
    this.config = {
      windowMs: config.windowMs,
      max: config.max,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      message: config.message || 'Too many requests, please try again later',
      store: this.store
    };
  }

  /**
   * Default key generator using IP address and user agent
   */
  private defaultKeyGenerator(request: NextRequest): string {
    const ip = this.getClientIp(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';
    return `rate_limit:${ip}:${userAgent}`;
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(request: NextRequest): string {
    // Check various headers that might contain the real IP
    const headers = [
      'x-forwarded-for',
      'x-real-ip',
      'x-client-ip',
      'cf-connecting-ip',
      'x-forwarded',
      'forwarded-for',
      'forwarded'
    ];

    for (const header of headers) {
      const value = request.headers.get(header);
      if (value) {
        // Handle comma-separated IPs (take the first one)
        return value.split(',')[0].trim();
      }
    }

    // Fallback to a default IP (in production, this should be the actual IP)
    return 'unknown';
  }

  /**
   * Check if request should be rate limited
   */
  async checkLimit(request: NextRequest): Promise<{
    allowed: boolean;
    info: RateLimitInfo;
    retryAfter?: number;
  }> {
    const key = this.config.keyGenerator(request);
    const info = await this.store.increment(key, this.config.windowMs);

    const allowed = info.count <= this.config.max;
    const retryAfter = allowed ? undefined : Math.ceil((info.resetTime - Date.now()) / 1000);

    return { allowed, info, retryAfter };
  }

  /**
   * Create rate limiting middleware
   */
  middleware() {
    return async (request: NextRequest): Promise<NextResponse | null> => {
      const correlationId = getCorrelationId(request);

      try {
        const { allowed, info, retryAfter } = await this.checkLimit(request);

        if (!allowed) {
          const retryAfterSeconds = retryAfter || Math.ceil(this.config.windowMs / 1000);
          
          return ApiResponse.tooManyRequests(
            `${this.config.message} (Retry after ${retryAfterSeconds} seconds)`,
            'RATE_LIMIT_EXCEEDED',
            { 
              retryAfter: retryAfterSeconds,
              limit: this.config.max,
              windowMs: this.config.windowMs
            },
            correlationId
          );
        }

        // Continue to next middleware/handler
        return null;

      } catch (error) {
        console.error('Rate limiting error:', error);
        // In case of rate limiter error, allow the request to proceed
        // but log the error for monitoring
        return null;
      }
    };
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */

/**
 * Strict rate limiter for authentication endpoints
 * 5 requests per 15 minutes
 */
export const authRateLimiter = new RateLimiter({
  windowMs: config.rateLimit.windowMs, // 15 minutes
  max: config.rateLimit.maxAttempts,   // 5 attempts
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (request: NextRequest) => {
    const ip = getClientIp(request);
    const endpoint = new URL(request.url).pathname;
    return `auth:${endpoint}:${ip}`;
  }
});

/**
 * Moderate rate limiter for general API endpoints
 * 100 requests per 15 minutes
 */
export const apiRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // 100 requests
  message: 'Too many requests, please try again later'
});

/**
 * Lenient rate limiter for read-only endpoints
 * 200 requests per 15 minutes
 */
export const readRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                 // 200 requests
  message: 'Too many requests, please try again later'
});

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per 15 minutes
 */
export const sensitiveRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                  // 10 requests
  message: 'Too many requests for this operation, please try again later'
});

/**
 * Rate limiting middleware factory
 */
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return limiter.middleware();
}

/**
 * Apply rate limiting to specific routes
 */
export function applyRateLimit(limiter: RateLimiter) {
  return createRateLimitMiddleware(limiter);
}

/**
 * Get client IP address (exported for reuse)
 */
export function getClientIp(request: NextRequest): string {
  const headers = [
    'x-forwarded-for',
    'x-real-ip', 
    'x-client-ip',
    'cf-connecting-ip',
    'x-forwarded',
    'forwarded-for',
    'forwarded'
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      return value.split(',')[0].trim();
    }
  }

  return 'unknown';
}

export default {
  RateLimiter,
  authRateLimiter,
  apiRateLimiter,
  readRateLimiter,
  sensitiveRateLimiter,
  createRateLimitMiddleware,
  applyRateLimit,
  getClientIp
};