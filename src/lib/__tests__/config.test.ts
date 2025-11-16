/**
 * Test suite for configuration validation
 */

import { config } from '@/lib/config';

describe('Configuration', () => {
  beforeEach(() => {
    // Store original env vars
    const originalEnv = process.env;
    
    // Reset modules to clear config cache
    jest.resetModules();
    
    // Restore env vars after test
    process.env = { ...originalEnv };
  });

  it('should load configuration without errors', () => {
    expect(config).toBeDefined();
    expect(config.jwt).toBeDefined();
    expect(config.database).toBeDefined();
    expect(config.redis).toBeDefined();
    expect(config.rateLimit).toBeDefined();
  });

  it('should have JWT configuration', () => {
    expect(config.jwt.secret).toBeDefined();
    expect(config.jwt.expiresIn).toBeDefined();
    expect(typeof config.jwt.getSecret).toBe('function');
  });

  it('should have database configuration', () => {
    expect(config.database.url).toBeDefined();
    expect(typeof config.database.getUrl).toBe('function');
    expect(config.database.pool).toBeDefined();
  });

  it('should have Redis configuration', () => {
    expect(config.redis.host).toBeDefined();
    expect(config.redis.port).toBeDefined();
    expect(typeof config.redis.port).toBe('number');
  });

  it('should have rate limiting configuration', () => {
    expect(config.rateLimit.windowMs).toBeDefined();
    expect(config.rateLimit.maxAttempts).toBeDefined();
    expect(typeof config.rateLimit.windowMs).toBe('number');
    expect(typeof config.rateLimit.maxAttempts).toBe('number');
  });

  it('should identify environment correctly', () => {
    expect(typeof config.isDevelopment).toBe('boolean');
    expect(typeof config.isProduction).toBe('boolean');
    expect(config.nodeEnv).toBeDefined();
  });
});