import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getRoomRepository, getUserRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { AuthenticatedRequest } from '@/lib/middleware/auth';
import { getCurrentUser } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';
import { DatabaseError } from '@/lib/errors/ApiError';

/**
 * Create new room
 */
async function handleCreateRoom(request: AuthenticatedRequest) {
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

    // Get request data
    const body = await request.json().catch(() => ({}));
    const { userName, passcode } = body;

    // Validate required fields
    if (!userName) {
      return ApiResponse.badRequest(
        'User name is required',
        'MISSING_USER_NAME',
        undefined,
        correlationId
      );
    }

    const roomRepository = getRoomRepository();
    const userRepository = getUserRepository();

    // Get user details for creator information
    const user = await userRepository.findById(currentUser.id);
    if (!user) {
      return ApiResponse.notFound(
        'User not found',
        'USER_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    // Create room with unique passcode
    let roomPasscode = passcode;
    if (!roomPasscode) {
      roomPasscode = await roomRepository.generateUniquePasscode(6);
    }

    const room = await roomRepository.create({
      passcode: roomPasscode,
      creator: currentUser.email,
      creatorName: userName
    });

    return ApiResponse.success(
      {
        roomId: room.id,
        passcode: room.passcode,
        shareUrl: `${process.env.CLIENT_URL || 'http://localhost:3000'}/room/${room.id}`
      },
      'Room created successfully',
      correlationId
    );

  } catch (error) {
    console.error('Room creation error:', error);

    // Handle specific database errors
    if (error instanceof DatabaseError) {
      if (error.code === 'UNIQUE_CONSTRAINT_VIOLATION') {
        return ApiResponse.conflict(
          'Room with this passcode already exists',
          'ROOM_PASSCODE_EXISTS',
          undefined,
          correlationId
        );
      }
    }

    return ApiResponse.internalError(
      'Failed to create room',
      'ROOM_CREATION_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Export authenticated endpoint
 */
export const POST = withRequiredAuth(handleCreateRoom);