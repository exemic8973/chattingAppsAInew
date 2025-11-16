/**
 * Standardized API response helpers
 * Provides consistent response format across all endpoints
 */

import { NextResponse } from 'next/server';

export interface ApiResponseData<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: string;
  correlationId?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class ApiResponse {
  /**
   * Create a successful API response
   */
  static success<T>(data: T, message = 'Success', correlationId?: string): NextResponse<ApiResponseData<T>> {
    return NextResponse.json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
      correlationId
    });
  }

  /**
   * Create an error API response
   */
  static error(
    message: string, 
    code = 'ERROR', 
    status = 400, 
    details?: any,
    correlationId?: string
  ): NextResponse<ApiResponseData> {
    return NextResponse.json({
      success: false,
      message: 'Request failed',
      error: {
        message,
        code,
        details
      },
      timestamp: new Date().toISOString(),
      correlationId
    }, { status });
  }

  /**
   * Create a paginated API response
   */
  static paginated<T>(
    data: T[], 
    pagination: PaginationInfo, 
    message = 'Success',
    correlationId?: string
  ): NextResponse<ApiResponseData<T[]>> {
    return NextResponse.json({
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString(),
      correlationId
    });
  }

  /**
   * Common HTTP status code helpers
   */
  static badRequest(message = 'Bad Request', code = 'BAD_REQUEST', details?: any, correlationId?: string) {
    return this.error(message, code, 400, details, correlationId);
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED', details?: any, correlationId?: string) {
    return this.error(message, code, 401, details, correlationId);
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN', details?: any, correlationId?: string) {
    return this.error(message, code, 403, details, correlationId);
  }

  static notFound(message = 'Not Found', code = 'NOT_FOUND', details?: any, correlationId?: string) {
    return this.error(message, code, 404, details, correlationId);
  }

  static conflict(message = 'Conflict', code = 'CONFLICT', details?: any, correlationId?: string) {
    return this.error(message, code, 409, details, correlationId);
  }

  static validationError(message = 'Validation Error', code = 'VALIDATION_ERROR', details?: any, correlationId?: string) {
    return this.error(message, code, 422, details, correlationId);
  }

  static tooManyRequests(message = 'Too Many Requests', code = 'RATE_LIMIT_EXCEEDED', details?: any, correlationId?: string) {
    return this.error(message, code, 429, details, correlationId);
  }

  static internalError(message = 'Internal Server Error', code = 'INTERNAL_ERROR', details?: any, correlationId?: string) {
    return this.error(message, code, 500, details, correlationId);
  }

  static serviceUnavailable(message = 'Service Unavailable', code = 'SERVICE_UNAVAILABLE', details?: any, correlationId?: string) {
    return this.error(message, code, 503, details, correlationId);
  }
}

/**
 * Generate correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract correlation ID from request headers
 */
export function getCorrelationId(request: Request): string {
  return request.headers.get('x-correlation-id') || generateCorrelationId();
}

/**
 * Common API response types
 */
export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    userName: string;
  };
}

export interface ErrorResponse {
  success: false;
  message: string;
  error: {
    message: string;
    code: string;
    details?: any;
  };
  timestamp: string;
  correlationId?: string;
}

export default ApiResponse;