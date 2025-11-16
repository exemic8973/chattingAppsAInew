/**
 * Unified authentication middleware for Next.js API routes
 * Provides consistent JWT verification and user authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { AuthenticationError } from '@/lib/errors/ApiError';
import { ApiResponse, getCorrelationId } from '@/lib/api/response';
import { config } from '@/lib/config';

/**
 * Authenticated request type that includes user information
 */
export interface AuthenticatedRequest extends NextRequest {
  user?: {
    id: string;
    email: string;
    userName: string;
    iat?: number;
    exp?: number;
  };
}

/**
 * Authentication middleware options
 */
export interface AuthMiddlewareOptions {
  required?: boolean; // Whether authentication is required (default: true)
  roles?: string[]; // Required roles for access
  permissions?: string[]; // Required permissions for access
}

/**
 * Verify JWT token and extract user information
 */
export async function authenticateToken(token: string): Promise<{
  success: true;
  user: AuthenticatedRequest['user'];
} | {
  success: false;
  error: AuthenticationError;
}> {
  try {
    // Verify token using the secure config
    const secret = config.jwt.getSecret();
    const decoded = await verifyToken(token, secret);

    if (!decoded || typeof decoded !== 'object') {
      return {
        success: false,
        error: AuthenticationError.invalidToken('Token decode failed')
      };
    }

    // Validate required user fields
    if (!decoded.id || !decoded.email) {
      return {
        success: false,
        error: AuthenticationError.invalidToken('Missing required user information')
      };
    }

    // Check token expiration
    if (decoded.exp && decoded.exp < Date.now() / 1000) {
      return {
        success: false,
        error: AuthenticationError.invalidToken('Token has expired')
      };
    }

    return {
      success: true,
      user: {
        id: decoded.id,
        email: decoded.email,
        userName: decoded.userName || decoded.email,
        iat: decoded.iat,
        exp: decoded.exp
      }
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return {
      success: false,
      error: AuthenticationError.invalidToken('Token verification failed')
    };
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Authentication middleware for Next.js API routes
 */
export function withAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>,
  options: AuthMiddlewareOptions = {}
) {
  const { required = true } = options;

  return async (request: NextRequest): Promise<NextResponse> => {
    const correlationId = getCorrelationId(request);

    try {
      // Extract token from Authorization header
      const authHeader = request.headers.get('authorization');
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        if (required) {
          return ApiResponse.unauthorized(
            'Authentication required',
            'MISSING_TOKEN',
            undefined,
            correlationId
          );
        }
        // If authentication is not required, proceed without user
        return handler(request as AuthenticatedRequest);
      }

      // Verify token
      const result = await authenticateToken(token);

      if (!result.success) {
        if (required) {
          return ApiResponse.unauthorized(
            result.error.message,
            result.error.code,
            undefined,
            correlationId
          );
        }
        // If authentication is not required, proceed without user
        return handler(request as AuthenticatedRequest);
      }

      // Add user to request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = result.user;

      // Call the handler with authenticated request
      return handler(authenticatedRequest);

    } catch (error) {
      console.error('Authentication middleware error:', error);
      
      if (required) {
        return ApiResponse.unauthorized(
          'Authentication failed',
          'AUTH_FAILED',
          undefined,
          correlationId
        );
      }
      
      // If authentication is not required, proceed without user
      return handler(request as AuthenticatedRequest);
    }
  };
}

/**
 * Optional authentication middleware
 * Allows access to both authenticated and unauthenticated users
 */
export function withOptionalAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, { required: false });
}

/**
 * Required authentication middleware
 * Denies access to unauthenticated users
 */
export function withRequiredAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(handler, { required: true });
}

/**
 * Admin-only authentication middleware
 * Requires admin role for access
 */
export function withAdminAuth(
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
) {
  return withAuth(async (request: AuthenticatedRequest) => {
    if (!request.user) {
      return ApiResponse.unauthorized('Authentication required');
    }

    // TODO: Implement role-based access control
    // For now, we'll use a simple check for admin email domains
    const adminEmails = ['admin@', 'root@', 'system@'];
    const isAdmin = adminEmails.some(domain => request.user!.email.includes(domain));

    if (!isAdmin) {
      return ApiResponse.forbidden('Admin access required');
    }

    return handler(request);
  }, { required: true });
}

/**
 * Get current user from authenticated request
 */
export function getCurrentUser(request: AuthenticatedRequest): AuthenticatedRequest['user'] {
  return request.user;
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(request: AuthenticatedRequest): boolean {
  return !!request.user;
}

/**
 * Get user ID from authenticated request
 */
export function getUserId(request: AuthenticatedRequest): string | null {
  return request.user?.id || null;
}

/**
 * Get user email from authenticated request
 */
export function getUserEmail(request: AuthenticatedRequest): string | null {
  return request.user?.email || null;
}

export default {
  withAuth,
  withOptionalAuth,
  withRequiredAuth,
  withAdminAuth,
  authenticateToken,
  extractTokenFromHeader,
  getCurrentUser,
  isAuthenticated,
  getUserId,
  getUserEmail
};