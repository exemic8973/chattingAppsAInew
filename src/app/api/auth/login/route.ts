import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { getUserRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { withValidation } from '@/lib/validation/auth';
import { loginSchema } from '@/lib/validation/auth';
import { authRateLimiter } from '@/lib/middleware/rateLimit';
import { applyRateLimit } from '@/lib/middleware/rateLimit';
import { getCorrelationId } from '@/lib/api/response';
import { User } from '@/lib/repositories/UserRepository';

/**
 * Apply rate limiting to login endpoint
 */
const rateLimitMiddleware = applyRateLimit(authRateLimiter);

/**
 * Handle login request with validation and rate limiting
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMiddleware(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Validate request body
    const validationResult = await withValidation(loginSchema)(request);
    if (!validationResult.success) {
      return validationResult.response;
    }

    const { email, password } = validationResult.data;
    const userRepository = getUserRepository();

    // Validate user credentials
    const user = await userRepository.validatePassword(email, password);
    if (!user) {
      return ApiResponse.unauthorized(
        'Invalid email or password',
        'INVALID_CREDENTIALS',
        undefined,
        correlationId
      );
    }

    // Generate JWT token with user ID
    const token = generateToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName
    });

    // Return safe user data (without password)
    const safeUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName
    };

    return ApiResponse.success(
      {
        token,
        user: safeUser
      },
      'Login successful',
      correlationId
    );

  } catch (error) {
    console.error('Login error:', error);
    return ApiResponse.internalError(
      'An error occurred during login',
      'LOGIN_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}