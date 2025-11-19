/**
 * Raise Hand Feature
 * Allows participants to raise/lower their hand during meetings
 */

import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getRoomRepository, getRoomParticipantRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { AuthenticatedRequest, getCurrentUser } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';

/**
 * Raise hand (participant)
 */
async function handleRaiseHand(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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

    // Check if hand is already raised
    if (participant.isHandRaised) {
      return ApiResponse.success(
        {
          participantId: participant.id,
          userId: participant.userId,
          userName: participant.userName,
          isHandRaised: true,
          message: 'Your hand is already raised'
        },
        'Hand is already raised',
        correlationId
      );
    }

    // Raise hand
    await roomParticipantRepository.updateParticipantStatus(roomId, currentUser.id, {
      isHandRaised: true
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        isHandRaised: true,
        raisedAt: new Date().toISOString()
      },
      'Hand raised successfully',
      correlationId
    );

  } catch (error) {
    console.error('Raise hand error:', error);
    return ApiResponse.internalError(
      'Failed to raise hand',
      'RAISE_HAND_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Lower hand (participant)
 */
async function handleLowerHand(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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

    // Check if hand is already lowered
    if (!participant.isHandRaised) {
      return ApiResponse.success(
        {
          participantId: participant.id,
          userId: participant.userId,
          userName: participant.userName,
          isHandRaised: false,
          message: 'Your hand is already lowered'
        },
        'Hand is already lowered',
        correlationId
      );
    }

    // Lower hand
    await roomParticipantRepository.updateParticipantStatus(roomId, currentUser.id, {
      isHandRaised: false
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        isHandRaised: false,
        loweredAt: new Date().toISOString()
      },
      'Hand lowered successfully',
      correlationId
    );

  } catch (error) {
    console.error('Lower hand error:', error);
    return ApiResponse.internalError(
      'Failed to lower hand',
      'LOWER_HAND_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get participants with raised hands (host or participant)
 */
async function handleGetRaisedHands(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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

    // Get participants with raised hands
    const raisedHandParticipants = await roomParticipantRepository.findParticipantsWithRaisedHands(roomId);

    return ApiResponse.success(
      {
        raisedHands: raisedHandParticipants.map(participant => ({
          participantId: participant.id,
          userId: participant.userId,
          userName: participant.userName,
          isHost: participant.isHost,
          raisedAt: participant.joinedAt // Using joinedAt as raisedAt timestamp
        })),
        count: raisedHandParticipants.length
      },
      'Raised hands retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get raised hands error:', error);
    return ApiResponse.internalError(
      'Failed to get raised hands',
      'GET_RAISED_HANDS_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Lower hand for another participant (host only)
 */
async function handleLowerOtherHand(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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
        'Only room hosts can lower other participants\' hands',
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

    // Check if hand is already lowered
    if (!participant.isHandRaised) {
      return ApiResponse.success(
        {
          participantId: participant.id,
          userId: participant.userId,
          userName: participant.userName,
          isHandRaised: false,
          message: 'Hand is already lowered'
        },
        'Hand is already lowered',
        correlationId
      );
    }

    // Lower the hand
    await roomParticipantRepository.update(participantId, {
      isHandRaised: false
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        isHandRaised: false,
        loweredBy: currentUser.userName,
        loweredAt: new Date().toISOString()
      },
      'Hand lowered successfully',
      correlationId
    );

  } catch (error) {
    console.error('Lower other hand error:', error);
    return ApiResponse.internalError(
      'Failed to lower hand',
      'LOWER_HAND_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Handle POST request (raise hand)
 */
export async function POST(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleRaiseHand(request, context);
}

/**
 * Handle DELETE request (lower hand)
 */
export async function DELETE(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleLowerHand(request, context);
}

/**
 * Handle GET request (get raised hands)
 */
export async function GET(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleGetRaisedHands(request, context);
}

/**
 * Handle PATCH request (lower other hand - host only)
 */
export async function PATCH(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleLowerOtherHand(request, context);
}