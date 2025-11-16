/**
 * Custom API error classes for consistent error handling
 */

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  static badRequest(message: string, code?: string, details?: any): ApiError {
    return new ApiError(400, message, code || 'BAD_REQUEST', details);
  }

  static unauthorized(message: string = 'Unauthorized', code?: string, details?: any): ApiError {
    return new ApiError(401, message, code || 'UNAUTHORIZED', details);
  }

  static forbidden(message: string = 'Forbidden', code?: string, details?: any): ApiError {
    return new ApiError(403, message, code || 'FORBIDDEN', details);
  }

  static notFound(message: string = 'Not found', code?: string, details?: any): ApiError {
    return new ApiError(404, message, code || 'NOT_FOUND', details);
  }

  static conflict(message: string = 'Conflict', code?: string, details?: any): ApiError {
    return new ApiError(409, message, code || 'CONFLICT', details);
  }

  static validationError(message: string = 'Validation failed', code?: string, details?: any): ApiError {
    return new ApiError(422, message, code || 'VALIDATION_ERROR', details);
  }

  static tooManyRequests(message: string = 'Too many requests', code?: string, details?: any): ApiError {
    return new ApiError(429, message, code || 'RATE_LIMIT_EXCEEDED', details);
  }

  static internal(message: string = 'Internal server error', code?: string, details?: any): ApiError {
    return new ApiError(500, message, code || 'INTERNAL_ERROR', details);
  }

  static serviceUnavailable(message: string = 'Service unavailable', code?: string, details?: any): ApiError {
    return new ApiError(503, message, code || 'SERVICE_UNAVAILABLE', details);
  }

  toJSON() {
    return {
      name: this.name,
      statusCode: this.statusCode,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack
    };
  }
}

/**
 * Authentication-specific errors
 */
export class AuthenticationError extends ApiError {
  constructor(message: string, code?: string, details?: any) {
    super(401, message, code || 'AUTHENTICATION_FAILED', details);
    this.name = 'AuthenticationError';
  }

  static invalidToken(details?: any): AuthenticationError {
    return new AuthenticationError('Invalid or expired token', 'INVALID_TOKEN', details);
  }

  static missingToken(): AuthenticationError {
    return new AuthenticationError('Authentication token is required', 'MISSING_TOKEN');
  }

  static insufficientPermissions(): AuthenticationError {
    return new AuthenticationError('Insufficient permissions', 'INSUFFICIENT_PERMISSIONS');
  }
}

/**
 * Validation errors
 */
export class ValidationError extends ApiError {
  constructor(message: string, public fields?: Record<string, string[]>, details?: any) {
    super(422, message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }

  static invalidFields(fields: Record<string, string[]>): ValidationError {
    const message = 'One or more fields contain invalid values';
    return new ValidationError(message, fields);
  }

  static missingField(fieldName: string): ValidationError {
    return new ValidationError(`Field '${fieldName}' is required`, { [fieldName]: ['This field is required'] });
  }

  static invalidFormat(fieldName: string, expectedFormat: string): ValidationError {
    return new ValidationError(
      `Field '${fieldName}' has invalid format`, 
      { [fieldName]: [`Expected format: ${expectedFormat}`] }
    );
  }
}

/**
 * Database errors
 */
export class DatabaseError extends ApiError {
  constructor(message: string, code?: string, details?: any) {
    super(500, message, code || 'DATABASE_ERROR', details);
    this.name = 'DatabaseError';
  }

  static connectionFailed(details?: any): DatabaseError {
    return new DatabaseError('Database connection failed', 'CONNECTION_FAILED', details);
  }

  static queryFailed(details?: any): DatabaseError {
    return new DatabaseError('Database query failed', 'QUERY_FAILED', details);
  }

  static uniqueConstraintViolation(field: string, details?: any): DatabaseError {
    return new DatabaseError(
      `Unique constraint violation on field: ${field}`, 
      'UNIQUE_CONSTRAINT_VIOLATION', 
      details
    );
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests', retryAfter?: number, details?: any) {
    super(429, message, 'RATE_LIMIT_EXCEEDED', { retryAfter, ...details });
    this.name = 'RateLimitError';
  }

  static tooManyAttempts(retryAfter: number): RateLimitError {
    return new RateLimitError(
      `Too many attempts. Please try again in ${Math.ceil(retryAfter / 1000)} seconds.`,
      retryAfter
    );
  }
}

/**
 * Global error handler middleware
 */
export function errorHandler(error: Error): {
  statusCode: number;
  response: any;
} {
  // Handle known API errors
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      response: {
        success: false,
        message: 'Request failed',
        error: {
          message: error.message,
          code: error.code,
          details: error.details
        },
        timestamp: new Date().toISOString()
      }
    };
  }

  // Handle unknown errors
  console.error('Unhandled error:', error);
  
  return {
    statusCode: 500,
    response: {
      success: false,
      message: 'Internal server error',
      error: {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      },
      timestamp: new Date().toISOString()
    }
  };
}

export default ApiError;