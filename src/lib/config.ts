/**
 * Secure configuration management for the application
 * Enforces required environment variables and provides type-safe access
 */

interface Config {
  jwt: {
    secret: string;
    expiresIn: string;
    getSecret: () => string;
  };
  database: {
    url: string;
    getUrl: () => string;
    pool: {
      max: number;
      idleTimeoutMillis: number;
      connectionTimeoutMillis: number;
    };
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  rateLimit: {
    windowMs: number;
    maxAttempts: number;
  };
  nodeEnv: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

class ConfigManager {
  private config: Config;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Config {
    const config: Config = {
      jwt: {
        secret: process.env.JWT_SECRET || '',
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        getSecret: () => {
          if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET environment variable is required');
          }
          return process.env.JWT_SECRET;
        }
      },
      database: {
        url: process.env.DATABASE_URL || '',
        getUrl: () => {
          if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL environment variable is required');
          }
          return process.env.DATABASE_URL;
        },
        pool: {
          max: parseInt(process.env.DB_POOL_MAX || '20'),
          idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
          connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000')
        }
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD
      },
      rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
        maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS || '5')
      },
      nodeEnv: process.env.NODE_ENV || 'development',
      isDevelopment: process.env.NODE_ENV === 'development',
      isProduction: process.env.NODE_ENV === 'production'
    };

    // Validate required configuration
    this.validateConfig(config);

    return config;
  }

  private validateConfig(config: Config): void {
    const errors: string[] = [];

    // Validate JWT configuration
    if (!config.jwt.secret && config.isProduction) {
      errors.push('JWT_SECRET is required in production');
    }

    // Validate database configuration - only require in production or when not in build
    if (!config.database.url && config.isProduction && process.env.NODE_ENV !== 'development') {
      errors.push('DATABASE_URL is required');
    }

    // Validate Redis configuration
    if (isNaN(config.redis.port) || config.redis.port < 1 || config.redis.port > 65535) {
      errors.push('REDIS_PORT must be a valid port number (1-65535)');
    }

    // Validate rate limiting configuration
    if (isNaN(config.rateLimit.windowMs) || config.rateLimit.windowMs < 60000) {
      errors.push('RATE_LIMIT_WINDOW_MS must be at least 60000 (1 minute)');
    }

    if (isNaN(config.rateLimit.maxAttempts) || config.rateLimit.maxAttempts < 1) {
      errors.push('RATE_LIMIT_MAX_ATTEMPTS must be at least 1');
    }

    // Only throw errors in production or when explicitly required
    if (errors.length > 0 && (config.isProduction || process.env.NODE_ENV !== 'development')) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  getConfig(): Config {
    return this.config;
  }

  // Helper methods for common configurations
  getJwtConfig() {
    return this.config.jwt;
  }

  getDatabaseConfig() {
    return this.config.database;
  }

  getRedisConfig() {
    return this.config.redis;
  }

  getRateLimitConfig() {
    return this.config.rateLimit;
  }
}

// Create singleton instance
const configManager = new ConfigManager();

// Export configuration and helper functions
export const config = configManager.getConfig();
export default config;