import { NextRequest } from 'next/server';
import { generateToken } from '@/lib/auth';
import { getUserRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { withValidation } from '@/lib/validation/auth';
import { signupSchema } from '@/lib/validation/auth';
import { getCorrelationId } from '@/lib/api/response';

/**
 * Handle signup request with validation
 */
export async function POST(request: NextRequest) {
  const correlationId = getCorrelationId(request);

  try {
    // Validate request body
    const validationResult = await withValidation(signupSchema)(request);
    if (!validationResult.success) {
      return validationResult.response;
    }

    const { email, password, fullName } = validationResult.data;
    const userRepository = getUserRepository();

    // Create user with password hashing
    const user = await userRepository.create({
      email,
      password,
      fullName
    });

    // Generate JWT token
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
      'User created successfully',
      correlationId
    );

  } catch (error) {
    console.error('Signup error:', error);
    
    // Handle specific database errors
    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      return ApiResponse.conflict(
        'User with this email already exists',
        'USER_ALREADY_EXISTS',
        undefined,
        correlationId
      );
    }

    return ApiResponse.internalError(
      'An error occurred during signup',
      'SIGNUP_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}