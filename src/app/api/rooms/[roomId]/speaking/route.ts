/**
 * Speaking Indicators API
 * Manages real-time speaking indicators and audio level detection
 */

import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getRoomRepository, getRoomParticipantRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { AuthenticatedRequest, getCurrentUser } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';

/**
 * Update speaking status (called by client periodically)
 */
async function handleUpdateSpeakingStatus(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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
    const { audioLevel, isSpeaking } = body;

    // Validate input
    if (typeof audioLevel !== 'number' || audioLevel < 0 || audioLevel > 1) {
      return ApiResponse.badRequest(
        'Audio level must be a number between 0 and 1',
        'INVALID_AUDIO_LEVEL',
        undefined,
        correlationId
      );
    }

    if (typeof isSpeaking !== 'boolean') {
      return ApiResponse.badRequest(
        'isSpeaking must be a boolean',
        'INVALID_SPEAKING_STATUS',
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

    // Update participant's speaking state (this would typically be handled by socket events)
    // For now, we'll just validate and return success
    // The actual speaking indicator updates should happen via socket.io for real-time updates

    return ApiResponse.success(
      {
        participantId: participant.id,
        userId: participant.userId,
        userName: participant.userName,
        audioLevel,
        isSpeaking,
        updatedAt: new Date().toISOString()
      },
      'Speaking status updated successfully',
      correlationId
    );

  } catch (error) {
    console.error('Update speaking status error:', error);
    return ApiResponse.internalError(
      'Failed to update speaking status',
      'UPDATE_SPEAKING_STATUS_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get current speaking participants (any participant)
 */
async function handleGetSpeakingParticipants(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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

    // Get active participants (in a real implementation, this would include real-time speaking status)
    const activeParticipants = await roomParticipantRepository.findActiveParticipants(roomId);
    
    // For now, we'll return all active participants with speaking status
    // In a real implementation, this would be based on recent audio level updates
    const speakingParticipants = activeParticipants.map(participant => ({
      participantId: participant.id,
      userId: participant.userId,
      userName: participant.userName,
      isHost: participant.isHost,
      isMuted: participant.isMuted,
      isSpeaking: false, // This would be determined by recent audio level updates
      audioLevel: 0,
      lastSpeakingUpdate: null
    }));

    return ApiResponse.success(
      {
        speakingParticipants,
        count: speakingParticipants.length,
        lastUpdate: new Date().toISOString()
      },
      'Speaking participants retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get speaking participants error:', error);
    return ApiResponse.internalError(
      'Failed to get speaking participants',
      'GET_SPEAKING_PARTICIPANTS_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get speaking activity history (host only)
 */
async function handleGetSpeakingActivity(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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

    const url = new URL(request.url);
    const timeWindow = parseInt(url.searchParams.get('timeWindow') || '300'); // 5 minutes default

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
        'Only room hosts can view speaking activity history',
        'NOT_HOST',
        undefined,
        correlationId
      );
    }

    // In a real implementation, this would query the speaking_activity table
    // For now, we'll return a mock response structure
    const mockSpeakingActivity = {
      activity: [],
      timeWindow,
      summary: {
        totalSpeakingTime: 0,
        mostActiveSpeaker: null,
        averageAudioLevel: 0,
        peakActivityTime: null
      }
    };

    return ApiResponse.success(
      mockSpeakingActivity,
      'Speaking activity history retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get speaking activity error:', error);
    return ApiResponse.internalError(
      'Failed to get speaking activity',
      'GET_SPEAKING_ACTIVITY_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get speaking analytics (host only)
 */
async function handleGetSpeakingAnalytics(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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

    const url = new URL(request.url);
    const startTime = url.searchParams.get('startTime');
    const endTime = url.searchParams.get('endTime');

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
        'Only room hosts can view speaking analytics',
        'NOT_HOST',
        undefined,
        correlationId
      );
    }

    // In a real implementation, this would query the speaking_activity table with time filters
    // For now, we'll return a mock analytics structure
    const mockAnalytics = {
      participants: [],
      timeline: [],
      summary: {
        totalMeetingTime: 0,
        totalSpeakingTime: 0,
        averageSpeakingTime: 0,
        mostActiveParticipant: null,
        participationRate: 0,
        audioQualityMetrics: {
          averageAudioLevel: 0,
          peakAudioLevel: 0,
          poorQualityIncidents: 0
        }
      },
      timeRange: {
        start: startTime || room.createdAt,
        end: endTime || new Date().toISOString()
      }
    };

    return ApiResponse.success(
      mockAnalytics,
      'Speaking analytics retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get speaking analytics error:', error);
    return ApiResponse.internalError(
      'Failed to get speaking analytics',
      'GET_SPEAKING_ANALYTICS_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Handle POST request (update speaking status)
 */
export async function POST(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleUpdateSpeakingStatus(request, context);
}

/**
 * Handle GET request (get speaking data)
 */
export async function GET(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'participants';

  switch (type) {
    case 'participants':
      return handleGetSpeakingParticipants(request, context);
    case 'activity':
      return handleGetSpeakingActivity(request, context);
    case 'analytics':
      return handleGetSpeakingAnalytics(request, context);
    default:
      return handleGetSpeakingParticipants(request, context);
  }
}