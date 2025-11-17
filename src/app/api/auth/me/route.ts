import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getUserRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { getCurrentUser } from '@/lib/middleware/auth';
import { AuthenticatedRequest } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';

/**
 * Get current authenticated user
 */
async function handleGetMe(request: AuthenticatedRequest) {
  const correlationId = getCorrelationId(request);
  
  try {
    const currentUser = getCurrentUser(request);
    if (!currentUser) {
      return ApiResponse.unauthorized(
        'User not authenticated',
        'NOT_AUTHENTICATED',
        undefined,
        correlationId
      );
    }

    const userRepository = getUserRepository();
    
    // Get user by ID (safe method - without password)
    const user = await userRepository.findByIdSafe(currentUser.id);
    if (!user) {
      return ApiResponse.notFound(
        'User not found',
        'USER_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    return ApiResponse.success(
      { user },
      'User retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get user error:', error);
    return ApiResponse.internalError(
      'Failed to retrieve user information',
      'GET_USER_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Export authenticated endpoint
 */
export const GET = withRequiredAuth(handleGetMe);