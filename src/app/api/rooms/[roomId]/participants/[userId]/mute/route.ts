/**
 * Host Control: Mute Participant
 * Allows room host to mute a specific participant
 */

import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getRoomRepository, getRoomParticipantRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { AuthenticatedRequest, getCurrentUser } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';

/**
 * Mute a participant (host only)
 */
async function handleMuteParticipant(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string; userId: string }> }) {
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
        'Only room hosts can mute participants',
        'NOT_HOST',
        undefined,
        correlationId
      );
    }

    // Check if target participant exists and is active
    const targetParticipant = await roomParticipantRepository.findByRoomAndUser(roomId, userId);
    if (!targetParticipant) {
      return ApiResponse.notFound(
        'Participant not found in room',
        'PARTICIPANT_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    if (targetParticipant.joinStatus !== 'approved') {
      return ApiResponse.badRequest(
        'Cannot mute participant who is not active in the room',
        'PARTICIPANT_NOT_ACTIVE',
        undefined,
        correlationId
      );
    }

    // Check if trying to mute self
    if (targetParticipant.userId === currentUser.id) {
      return ApiResponse.badRequest(
        'Cannot mute yourself',
        'CANNOT_MUTE_SELF',
        undefined,
        correlationId
      );
    }

    // Check if participant is already muted
    if (targetParticipant.isMuted) {
      return ApiResponse.badRequest(
        'Participant is already muted',
        'ALREADY_MUTED',
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

    // Mute the participant
    await roomParticipantRepository.updateParticipantStatus(roomId, userId, {
      isMuted: true
    });

    // Log the host action
    await roomParticipantRepository.logHostAction({
      roomId,
      hostId: currentUser.id,
      targetUserId: userId,
      actionType: 'mute',
      reason
    });

    return ApiResponse.success(
      {
        participantId: userId,
        userName: targetParticipant.userName,
        isMuted: true,
        mutedBy: currentUser.userName,
        reason
      },
      'Participant muted successfully',
      correlationId
    );

  } catch (error) {
    console.error('Mute participant error:', error);
    return ApiResponse.internalError(
      'Failed to mute participant',
      'MUTE_PARTICIPANT_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Unmute a participant (host only)
 */
async function handleUnmuteParticipant(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string; userId: string }> }) {
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
        'Only room hosts can unmute participants',
        'NOT_HOST',
        undefined,
        correlationId
      );
    }

    // Check if target participant exists and is active
    const targetParticipant = await roomParticipantRepository.findByRoomAndUser(roomId, userId);
    if (!targetParticipant) {
      return ApiResponse.notFound(
        'Participant not found in room',
        'PARTICIPANT_NOT_FOUND',
        undefined,
        correlationId
      );
    }

    if (targetParticipant.joinStatus !== 'approved') {
      return ApiResponse.badRequest(
        'Cannot unmute participant who is not active in the room',
        'PARTICIPANT_NOT_ACTIVE',
        undefined,
        correlationId
      );
    }

    // Check if participant is not muted
    if (!targetParticipant.isMuted) {
      return ApiResponse.badRequest(
        'Participant is not muted',
        'NOT_MUTED',
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

    // Unmute the participant
    await roomParticipantRepository.updateParticipantStatus(roomId, userId, {
      isMuted: false
    });

    // Log the host action
    await roomParticipantRepository.logHostAction({
      roomId,
      hostId: currentUser.id,
      targetUserId: userId,
      actionType: 'unmute',
      reason
    });

    return ApiResponse.success(
      {
        participantId: userId,
        userName: targetParticipant.userName,
        isMuted: false,
        unmutedBy: currentUser.userName,
        reason
      },
      'Participant unmuted successfully',
      correlationId
    );

  } catch (error) {
    console.error('Unmute participant error:', error);
    return ApiResponse.internalError(
      'Failed to unmute participant',
      'UNMUTE_PARTICIPANT_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Handle POST request (mute)
 */
export async function POST(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string; userId: string }> }) {
  return handleMuteParticipant(request, context);
}

/**
 * Handle DELETE request (unmute)
 */
export async function DELETE(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string; userId: string }> }) {
  return handleUnmuteParticipant(request, context);
}