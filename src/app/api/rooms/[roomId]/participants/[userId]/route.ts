/**
 * Host Control: Remove Participant
 * Allows room host to remove a specific participant from the room
 */

import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getRoomRepository, getRoomParticipantRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { AuthenticatedRequest, getCurrentUser } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';

/**
 * Remove a participant from the room (host only)
 */
async function handleRemoveParticipant(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string; userId: string }> }) {
  const correlationId = getCorrelationId(request);
  const { roomId, userId } = await context.params;

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

    // Check if current user is host
    const isHost = await roomParticipantRepository.isUserHost(roomId, currentUser.id);
    if (!isHost) {
      return ApiResponse.forbidden(
        'Only room hosts can remove participants',
        'NOT_HOST',
        undefined,
        correlationId
      );
    }

    // Check if target participant exists
    const targetParticipant = await roomParticipantRepository.findByRoomAndUser(roomId, userId);
    if (!targetParticipant) {
      return ApiResponse.notFound(
        'Participant not found in room',
        'PARTICIPANT_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    // Check if trying to remove self
    if (targetParticipant.userId === currentUser.id) {
      return ApiResponse.badRequest(
        'Cannot remove yourself from the room',
        'CANNOT_REMOVE_SELF',
        undefined,
        correlationId
      );
    }

    // Check if participant is already removed
    if (targetParticipant.joinStatus === 'removed') {
      return ApiResponse.badRequest(
        'Participant is already removed',
        'ALREADY_REMOVED',
        undefined,
        correlationId
      );
    }

    // Get reason from request body (optional)
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // Body is optional
    }

    // Remove the participant
    await roomParticipantRepository.removeParticipant(roomId, userId);

    // Log the host action
    await roomParticipantRepository.logHostAction({
      roomId,
      hostId: currentUser.id,
      targetUserId: userId,
      actionType: 'remove',
      reason
    });

    return ApiResponse.success(
      {
        participantId: userId,
        userName: targetParticipant.userName,
        removedBy: currentUser.userName,
        reason,
        removedAt: new Date().toISOString()
      },
      'Participant removed successfully',
      correlationId
    );

  } catch (error) {
    console.error('Remove participant error:', error);
    return ApiResponse.internalError(
      'Failed to remove participant',
      'REMOVE_PARTICIPANT_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get participant information (host only)
 */
async function handleGetParticipant(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string; userId: string }> }) {
  const correlationId = getCorrelationId(request);
  const { roomId, userId } = await context.params;

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

    // Check if current user is host or requesting their own info
    const isHost = await roomParticipantRepository.isUserHost(roomId, currentUser.id);
    const isSelf = userId === currentUser.id;
    
    if (!isHost && !isSelf) {
      return ApiResponse.forbidden(
        'Only room hosts can view other participants\' information',
        'NOT_AUTHORIZED',
        undefined,
        correlationId
      );
    }

    // Get participant information
    const participant = await roomParticipantRepository.findByRoomAndUser(roomId, userId);
    if (!participant) {
      return ApiResponse.notFound(
        'Participant not found in room',
        'PARTICIPANT_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    return ApiResponse.success(
      {
        id: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        isHost: participant.isHost,
        isMuted: participant.isMuted,
        isVideoOff: participant.isVideoOff,
        isScreenSharing: participant.isScreenSharing,
        isHandRaised: participant.isHandRaised,
        joinStatus: participant.joinStatus,
        joinedAt: participant.joinedAt,
        leftAt: participant.leftAt
      },
      'Participant information retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get participant error:', error);
    return ApiResponse.internalError(
      'Failed to get participant information',
      'GET_PARTICIPANT_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

export async function DELETE(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string; userId: string }> }) {
  return handleRemoveParticipant(request, context);
}

export async function GET(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string; userId: string }> }) {
  return handleGetParticipant(request, context);
}