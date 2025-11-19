/**
 * Screen Sharing API
 * Manages screen sharing sessions during meetings
 */

import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getRoomRepository, getRoomParticipantRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { AuthenticatedRequest, getCurrentUser } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';

// Valid screen share types
type ScreenShareType = 'screen' | 'window' | 'tab';

/**
 * Start screen sharing session (any participant)
 */
async function handleStartScreenShare(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  const correlationId = getCorrelationId(request);
  const { roomId } = await context.params;

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

    const body = await request.json();
    const { sessionType = 'screen' as ScreenShareType } = body;

    const roomParticipantRepository = getRoomParticipantRepository();
    const roomRepository = getRoomRepository();

    // Verify room exists
    const room = await roomRepository.findById(roomId);
    if (!room) {
      return ApiResponse.notFound(
        'Room not found',
        'ROOM_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    // Check if user is an active participant
    const participant = await roomParticipantRepository.findByRoomAndUser(roomId, currentUser.id);
    if (!participant) {
      return ApiResponse.notFound(
        'You are not a participant in this room',
        'NOT_PARTICIPANT',
        undefined,
        correlationId
      );
    }

    if (participant.joinStatus !== 'approved') {
      return ApiResponse.forbidden(
        'You must be approved to participate in this room',
        'NOT_APPROVED',
        undefined,
        correlationId
      );
    }

    // Check if participant is already screen sharing
    if (participant.isScreenSharing) {
      return ApiResponse.badRequest(
        'You are already screen sharing',
        'ALREADY_SCREEN_SHARING',
        undefined,
        correlationId
      );
    }

    // Check if another participant is already screen sharing (optional limitation)
    const activeParticipants = await roomParticipantRepository.findActiveParticipants(roomId);
    const existingScreenShare = activeParticipants.find(p => p.isScreenSharing);
    
    if (existingScreenShare) {
      return ApiResponse.conflict(
        `${existingScreenShare.userName} is already screen sharing. Only one screen share is allowed at a time.`,
        'SCREEN_SHARE_IN_USE',
        {
          currentSharer: {
            userId: existingScreenShare.userId,
            userName: existingScreenShare.userName
          }
        },
        correlationId
      );
    }

    // Update participant's screen sharing status
    await roomParticipantRepository.updateParticipantStatus(roomId, currentUser.id, {
      isScreenSharing: true
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        sessionType,
        isActive: true,
        startedAt: new Date().toISOString(),
        message: 'Screen sharing session started successfully'
      },
      'Screen sharing session started',
      correlationId
    );

  } catch (error) {
    console.error('Start screen share error:', error);
    return ApiResponse.internalError(
      'Failed to start screen sharing session',
      'START_SCREEN_SHARE_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Stop screen sharing session (any participant)
 */
async function handleStopScreenShare(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  const correlationId = getCorrelationId(request);
  const { roomId } = await context.params;

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

    const roomParticipantRepository = getRoomParticipantRepository();
    const roomRepository = getRoomRepository();

    // Verify room exists
    const room = await roomRepository.findById(roomId);
    if (!room) {
      return ApiResponse.notFound(
        'Room not found',
        'ROOM_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    // Check if user is an active participant
    const participant = await roomParticipantRepository.findByRoomAndUser(roomId, currentUser.id);
    if (!participant) {
      return ApiResponse.notFound(
        'You are not a participant in this room',
        'NOT_PARTICIPANT',
        undefined,
        correlationId
      );
    }

    if (participant.joinStatus !== 'approved') {
      return ApiResponse.forbidden(
        'You must be approved to participate in this room',
        'NOT_APPROVED',
        undefined,
        correlationId
      );
    }

    // Check if participant is screen sharing
    if (!participant.isScreenSharing) {
      return ApiResponse.badRequest(
        'You are not currently screen sharing',
        'NOT_SCREEN_SHARING',
        undefined,
        correlationId
      );
    }

    // Update participant's screen sharing status
    await roomParticipantRepository.updateParticipantStatus(roomId, currentUser.id, {
      isScreenSharing: false
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        isActive: false,
        endedAt: new Date().toISOString(),
        message: 'Screen sharing session stopped successfully'
      },
      'Screen sharing session stopped',
      correlationId
    );

  } catch (error) {
    console.error('Stop screen share error:', error);
    return ApiResponse.internalError(
      'Failed to stop screen sharing session',
      'STOP_SCREEN_SHARE_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get active screen sharing sessions (any participant)
 */
async function handleGetScreenShares(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  const correlationId = getCorrelationId(request);
  const { roomId } = await context.params;

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

    const roomParticipantRepository = getRoomParticipantRepository();
    const roomRepository = getRoomRepository();

    // Verify room exists
    const room = await roomRepository.findById(roomId);
    if (!room) {
      return ApiResponse.notFound(
        'Room not found',
        'ROOM_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    // Check if user is a participant
    const participant = await roomParticipantRepository.findByRoomAndUser(roomId, currentUser.id);
    if (!participant) {
      return ApiResponse.notFound(
        'You are not a participant in this room',
        'NOT_PARTICIPANT',
        undefined,
        correlationId
      );
    }

    // Get active participants who are screen sharing
    const activeParticipants = await roomParticipantRepository.findActiveParticipants(roomId);
    const screenSharingParticipants = activeParticipants.filter(p => p.isScreenSharing);

    return ApiResponse.success(
      {
        screenShares: screenSharingParticipants.map(participant => ({
          participantId: participant.id,
          userId: participant.userId,
          userName: participant.userName,
          isHost: participant.isHost,
          startedAt: participant.joinedAt // Using joinedAt as startedAt for now
        })),
        count: screenSharingParticipants.length
      },
      'Screen sharing sessions retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get screen shares error:', error);
    return ApiResponse.internalError(
      'Failed to get screen sharing sessions',
      'GET_SCREEN_SHARES_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Host force stops screen sharing (host only)
 */
async function handleHostStopScreenShare(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  const correlationId = getCorrelationId(request);
  const { roomId } = await context.params;

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

    const body = await request.json();
    const { participantId } = body;

    if (!participantId) {
      return ApiResponse.badRequest(
        'Participant ID is required',
        'MISSING_PARTICIPANT_ID',
        undefined,
        correlationId
      );
    }

    const roomParticipantRepository = getRoomParticipantRepository();
    const roomRepository = getRoomRepository();

    // Verify room exists
    const room = await roomRepository.findById(roomId);
    if (!room) {
      return ApiResponse.notFound(
        'Room not found',
        'ROOM_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    // Check if current user is host
    const isHost = await roomParticipantRepository.isUserHost(roomId, currentUser.id);
    if (!isHost) {
      return ApiResponse.forbidden(
        'Only room hosts can stop other participants\' screen sharing',
        'NOT_HOST',
        undefined,
        correlationId
      );
    }

    // Get participant
    const participant = await roomParticipantRepository.findById(participantId);
    if (!participant) {
      return ApiResponse.notFound(
        'Participant not found',
        'PARTICIPANT_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    // Verify participant is in the correct room
    if (participant.roomId !== roomId) {
      return ApiResponse.badRequest(
        'Participant is not in this room',
        'INVALID_PARTICIPANT',
        undefined,
        correlationId
      );
    }

    // Check if participant is screen sharing
    if (!participant.isScreenSharing) {
      return ApiResponse.badRequest(
        'Participant is not currently screen sharing',
        'NOT_SCREEN_SHARING',
        undefined,
        correlationId
      );
    }

    // Stop the screen sharing
    await roomParticipantRepository.update(participantId, {
      isScreenSharing: false
    });

    // Log the host action
    await roomParticipantRepository.logHostAction({
      roomId,
      hostId: currentUser.id,
      targetUserId: participant.userId,
      actionType: 'stop_screen_share'
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        stoppedBy: currentUser.userName,
        stoppedAt: new Date().toISOString()
      },
      'Screen sharing stopped by host',
      correlationId
    );

  } catch (error) {
    console.error('Host stop screen share error:', error);
    return ApiResponse.internalError(
      'Failed to stop screen sharing session',
      'HOST_STOP_SCREEN_SHARE_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Handle POST request (start screen share)
 */
export async function POST(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleStartScreenShare(request, context);
}

/**
 * Handle DELETE request (stop screen share)
 */
export async function DELETE(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleStopScreenShare(request, context);
}

/**
 * Handle GET request (get screen shares)
 */
export async function GET(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleGetScreenShares(request, context);
}

/**
 * Handle PATCH request (host stop screen share)
 */
export async function PATCH(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleHostStopScreenShare(request, context);
}