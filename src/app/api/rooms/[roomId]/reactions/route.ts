/**
 * Meeting Reactions API
 * Handles real-time reactions during meetings
 */

import { NextRequest } from 'next/server';
import { withRequiredAuth } from '@/lib/middleware/auth';
import { getRoomRepository, getRoomParticipantRepository, getMeetingReactionRepository } from '@/lib/repositories/RepositoryFactory';
import { ApiResponse } from '@/lib/api/response';
import { AuthenticatedRequest, getCurrentUser } from '@/lib/middleware/auth';
import { getCorrelationId } from '@/lib/api/response';

// Valid reaction types
const VALID_REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '👏'] as const;
type ReactionType = typeof VALID_REACTIONS[number];

/**
 * Send a reaction (authenticated user)
 */
async function handleSendReaction(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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
    const { reaction } = body;

    // Validate reaction type
    if (!reaction || !VALID_REACTIONS.includes(reaction as ReactionType)) {
      return ApiResponse.badRequest(
        'Invalid reaction type. Valid reactions: ' + VALID_REACTIONS.join(', '),
        'INVALID_REACTION_TYPE',
        undefined,
        correlationId
      );
    }

    const roomParticipantRepository = getRoomParticipantRepository();
    const roomRepository = getRoomRepository();
    const meetingReactionRepository = getMeetingReactionRepository();

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

    // Create reaction with rate limiting
    const reactionData = await meetingReactionRepository.createReaction({
      roomId,
      userId: currentUser.id,
      userName: participant.userName,
      reactionType: reaction as ReactionType
    });

    return ApiResponse.success(
      {
        reactionId: reactionData.id,
        userId: reactionData.userId,
        userName: reactionData.userName,
        reaction: reactionData.reactionType,
        createdAt: reactionData.createdAt
      },
      'Reaction sent successfully',
      correlationId
    );

  } catch (error) {
    console.error('Send reaction error:', error);
    
    // Handle rate limiting error
    if (error.message?.includes('Too many reactions')) {
      return ApiResponse.rateLimitExceeded(
        'Too many reactions. Please wait a moment before sending another reaction.',
        'RATE_LIMIT_EXCEEDED',
        undefined,
        correlationId
      );
    }

    return ApiResponse.internalError(
      'Failed to send reaction',
      'SEND_REACTION_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get recent reactions (any participant)
 */
async function handleGetReactions(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const includeStats = url.searchParams.get('stats') === 'true';

    const roomParticipantRepository = getRoomParticipantRepository();
    const roomRepository = getRoomRepository();
    const meetingReactionRepository = getMeetingReactionRepository();

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

    // Get recent reactions
    const reactions = await meetingReactionRepository.getRecentReactions(roomId, limit);
    
    let stats = null;
    if (includeStats) {
      stats = await meetingReactionRepository.getReactionStats(roomId);
    }

    return ApiResponse.success(
      {
        reactions: reactions.map(reaction => ({
          id: reaction.id,
          userId: reaction.user_id,
          userName: reaction.user_name,
          reaction: reaction.reaction_type,
          createdAt: reaction.created_at
        })),
        count: reactions.length,
        stats
      },
      'Reactions retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get reactions error:', error);
    return ApiResponse.internalError(
      'Failed to get reactions',
      'GET_REACTIONS_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get reaction statistics (any participant)
 */
async function handleGetReactionStats(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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
    const meetingReactionRepository = getMeetingReactionRepository();

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

    // Get reaction statistics
    const stats = await meetingReactionRepository.getReactionStats(roomId);

    return ApiResponse.success(
      stats,
      'Reaction statistics retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get reaction stats error:', error);
    return ApiResponse.internalError(
      'Failed to get reaction statistics',
      'GET_REACTION_STATS_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Get reaction timeline (any participant)
 */
async function handleGetReactionTimeline(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
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
    const timeWindow = parseInt(url.searchParams.get('timeWindow') || '60');

    const roomParticipantRepository = getRoomParticipantRepository();
    const roomRepository = getRoomRepository();
    const meetingReactionRepository = getMeetingReactionRepository();

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

    // Get reaction timeline
    const timeline = await meetingReactionRepository.getReactionTimeline(roomId, timeWindow);

    return ApiResponse.success(
      {
        timeline: timeline.map(item => ({
          timeBucket: item.time_bucket,
          reactionType: item.reaction_type,
          count: item.count
        })),
        timeWindow
      },
      'Reaction timeline retrieved successfully',
      correlationId
    );

  } catch (error) {
    console.error('Get reaction timeline error:', error);
    return ApiResponse.internalError(
      'Failed to get reaction timeline',
      'GET_REACTION_TIMELINE_ERROR',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      correlationId
    );
  }
}

/**
 * Handle POST request (send reaction)
 */
export async function POST(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  return handleSendReaction(request, context);
}

/**
 * Handle GET request (get reactions)
 */
export async function GET(request: AuthenticatedRequest, context: { params: Promise<{ roomId: string }> }) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get('endpoint');

  switch (endpoint) {
    case 'stats':
      return handleGetReactionStats(request, context);
    case 'timeline':
      return handleGetReactionTimeline(request, context);
    default:
      return handleGetReactions(request, context);
  }
}