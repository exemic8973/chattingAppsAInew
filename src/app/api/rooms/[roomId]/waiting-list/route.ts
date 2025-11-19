/**
 * Waiting Room Management
 * Handles participant join requests and host approval/rejection
 */

import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getRoomRepository, getRoomParticipantRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { AuthenticatedRequest, getCurrentUser } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';

/**
 * Get waiting list (host only)
 */
async function handleGetWaitingList(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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

    // Check if current user is host
    const isHost = await roomParticipantRepository.isUserHost(roomId, currentUser.id);
    if (!isHost) {
      return ApiResponse.forbidden(
        'Only room hosts can view the waiting list',
        'NOT_HOST',
        undefined,
        correlationId
      );
    }

    // Get waiting participants
    const waitingParticipants = await roomParticipantRepository.findWaitingParticipants(roomId);

    return ApiResponse.success(
      {
        waitingList: waitingParticipants.map(participant => ({
          id: participant.id,
          userId: participant.userId,
          userName: participant.userName,
          joinedAt: participant.joinedAt
        })),
        count: waitingParticipants.length
      },
      'Waiting list retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get waiting list error:', error);
    return ApiResponse.internalError(
      'Failed to get waiting list',
      'GET_WAITING_LIST_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Request to join room (participant)
 */
async function handleRequestJoin(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  const correlationId = getCorrelationId(request);
  const { roomId } = await context.params;

  try {
    let userId: string;
    let userName: string;

    // Try to get user info from JWT token first
    try {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const { verifyToken } = await import('@/lib/auth');
        const decoded = verifyToken(token);
        userId = decoded.id;
        userName = decoded.userName;
      } else {
        // Fallback to guest user
        const body = await request.json();
        userId = body.userId || `guest-${Date.now()}`;
        userName = body.userName;
      }
    } catch {
      // Use guest credentials
      const body = await request.json();
      userId = body.userId || `guest-${Date.now()}`;
      userName = body.userName;
    }

    if (!userName) {
      return ApiResponse.badRequest(
        'User name is required',
        'MISSING_USER_NAME',
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

    // Check if user is already in the room
    const existingParticipant = await roomParticipantRepository.findByRoomAndUser(roomId, userId);
    if (existingParticipant) {
      if (existingParticipant.joinStatus === 'waiting') {
        return ApiResponse.success(
          {
            status: 'already_waiting',
            message: 'You are already in the waiting list'
          },
          'Join request already pending',
          correlationId
        );
      }
      
      if (existingParticipant.joinStatus === 'approved') {
        return ApiResponse.success(
          {
            status: 'already_joined',
            message: 'You are already in the room'
          },
          'Already joined the room',
          correlationId
        );
      }

      if (existingParticipant.joinStatus === 'rejected') {
        return ApiResponse.forbidden(
          'Your previous join request was rejected',
          'JOIN_REQUEST_REJECTED',
          undefined,
          correlationId
        );
      }

      if (existingParticipant.joinStatus === 'removed') {
        return ApiResponse.forbidden(
          'You have been removed from this room',
          'USER_REMOVED',
          undefined,
          correlationId
        );
      }
    }

    // Create waiting participant
    const participant = await roomParticipantRepository.createOrUpdate({
      roomId,
      userId,
      userName,
      joinStatus: 'waiting'
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        status: 'waiting',
        message: 'Join request submitted. Please wait for host approval.',
        joinedAt: participant.joinedAt
      },
      'Join request submitted successfully',
      correlationId
    );

  } catch (error) {
    console.error('Request join error:', error);
    return ApiResponse.internalError(
      'Failed to submit join request',
      'REQUEST_JOIN_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Approve join request (host only)
 */
async function handleApproveJoin(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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
        'Only room hosts can approve join requests',
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

    // Verify participant is in the correct room and status
    if (participant.roomId !== roomId) {
      return ApiResponse.badRequest(
        'Participant is not in this room',
        'INVALID_PARTICIPANT',
        undefined,
        correlationId
      );
    }

    if (participant.joinStatus !== 'waiting') {
      return ApiResponse.badRequest(
        'Participant is not in waiting status',
        'INVALID_STATUS',
        undefined,
        correlationId
      );
    }

    // Approve the participant
    await roomParticipantRepository.update(participantId, {
      joinStatus: 'approved'
    });

    // Log the host action
    await roomParticipantRepository.logHostAction({
      roomId,
      hostId: currentUser.id,
      targetUserId: participant.userId,
      actionType: 'approve_join'
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        status: 'approved',
        approvedAt: new Date().toISOString()
      },
      'Join request approved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Approve join error:', error);
    return ApiResponse.internalError(
      'Failed to approve join request',
      'APPROVE_JOIN_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Reject join request (host only)
 */
async function handleRejectJoin(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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
    const { participantId, reason } = body;

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
        'Only room hosts can reject join requests',
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

    // Verify participant is in the correct room and status
    if (participant.roomId !== roomId) {
      return ApiResponse.badRequest(
        'Participant is not in this room',
        'INVALID_PARTICIPANT',
        undefined,
        correlationId
      );
    }

    if (participant.joinStatus !== 'waiting') {
      return ApiResponse.badRequest(
        'Participant is not in waiting status',
        'INVALID_STATUS',
        undefined,
        correlationId
      );
    }

    // Reject the participant
    await roomParticipantRepository.update(participantId, {
      joinStatus: 'rejected'
    });

    // Log the host action
    await roomParticipantRepository.logHostAction({
      roomId,
      hostId: currentUser.id,
      targetUserId: participant.userId,
      actionType: 'reject_join',
      reason
    });

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        status: 'rejected',
        reason,
        rejectedAt: new Date().toISOString()
      },
      'Join request rejected successfully',
      correlationId
    );

  } catch (error) {
    console.error('Reject join error:', error);
    return ApiResponse.internalError(
      'Failed to reject join request',
      'REJECT_JOIN_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

export async function GET(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return withRequiredAuth(handleGetWaitingList)(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleRequestJoin(request, context);
}

export async function PUT(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return withRequiredAuth(handleApproveJoin)(request, context);
}

export async function DELETE(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return withRequiredAuth(handleRejectJoin)(request, context);
}

/**
 * Export authenticated endpoints
 */
export const GET_AUTH = withRequiredAuth(GET);
export const PUT_AUTH = withRequiredAuth(PUT);
export const DELETE_AUTH = withRequiredAuth(DELETE);