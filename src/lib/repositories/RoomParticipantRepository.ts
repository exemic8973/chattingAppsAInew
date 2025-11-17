/**
 * Room Participant Repository
 * Manages participant states, permissions, and interactions in rooms
 */

import { BaseRepository } from '@/lib/database/BaseRepository';
import { DatabaseConnection } from '@/lib/database/DatabaseConnection';
import { DatabaseError } from '@/lib/errors/ApiError';

/**
 * Room Participant entity interface
 */
export interface RoomParticipant extends BaseEntity {
  roomId: string;
  userId: string;
  userName: string;
  isHost: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  joinStatus: 'waiting' | 'approved' | 'rejected' | 'removed';
  joinedAt: string;
  leftAt?: string;
}

/**
 * Participant creation data
 */
export interface CreateParticipantData {
  roomId: string;
  userId: string;
  userName: string;
  isHost?: boolean;
  joinStatus?: 'waiting' | 'approved' | 'rejected' | 'removed';
}

/**
 * Participant update data
 */
export interface UpdateParticipantData {
  userName?: string;
  isHost?: boolean;
  isMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  isHandRaised?: boolean;
  joinStatus?: 'waiting' | 'approved' | 'rejected' | 'removed';
  leftAt?: string;
}

/**
 * Host action data for audit logging
 */
export interface HostActionData {
  roomId: string;
  hostId: string;
  targetUserId: string;
  actionType: 'mute' | 'unmute' | 'remove' | 'approve_join' | 'reject_join' | 'make_host' | 'remove_host';
  reason?: string;
}

/**
 * Room Participant repository
 */
export class RoomParticipantRepository extends BaseRepository<RoomParticipant> {
  protected tableName = 'room_participants';
  protected entityName = 'RoomParticipant';

  constructor(db: DatabaseConnection) {
    super(db);
  }

  /**
   * Find participant by room and user ID
   */
  async findByRoomAndUser(roomId: string, userId: string): Promise<RoomParticipant | null> {
    try {
      const result = await this.db.queryOne(
        `SELECT * FROM ${this.tableName} WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
        [roomId, userId]
      );
      return result;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find participant by room and user: ${error}`);
    }
  }

  /**
   * Find all participants in a room
   */
  async findByRoomId(roomId: string): Promise<RoomParticipant[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE room_id = $1 AND join_status != 'removed' ORDER BY joined_at ASC`,
        [roomId]
      );
      return result;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find participants by room: ${error}`);
    }
  }

  /**
   * Find active participants in a room
   */
  async findActiveParticipants(roomId: string): Promise<RoomParticipant[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE room_id = $1 AND join_status = 'approved' AND left_at IS NULL ORDER BY joined_at ASC`,
        [roomId]
      );
      return result;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find active participants: ${error}`);
    }
  }

  /**
   * Find participants waiting for approval
   */
  async findWaitingParticipants(roomId: string): Promise<RoomParticipant[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE room_id = $1 AND join_status = 'waiting' ORDER BY joined_at ASC`,
        [roomId]
      );
      return result;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find waiting participants: ${error}`);
    }
  }

  /**
   * Find participants with raised hands
   */
  async findParticipantsWithRaisedHands(roomId: string): Promise<RoomParticipant[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE room_id = $1 AND is_hand_raised = TRUE AND join_status = 'approved' ORDER BY joined_at ASC`,
        [roomId]
      );
      return result;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find participants with raised hands: ${error}`);
    }
  }

  /**
   * Check if user is host in room
   */
  async isUserHost(roomId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db.queryOne(
        `SELECT is_host FROM ${this.tableName} WHERE room_id = $1 AND user_id = $2 AND join_status = 'approved' LIMIT 1`,
        [roomId, userId]
      );
      return result?.is_host || false;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to check if user is host: ${error}`);
    }
  }

  /**
   * Get host of a room
   */
  async getRoomHost(roomId: string): Promise<RoomParticipant | null> {
    try {
      const result = await this.db.queryOne(
        `SELECT * FROM ${this.tableName} WHERE room_id = $1 AND is_host = TRUE AND join_status = 'approved' LIMIT 1`,
        [roomId]
      );
      return result;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to get room host: ${error}`);
    }
  }

  /**
   * Count participants in room by status
   */
  async countParticipantsByStatus(roomId: string, status?: string): Promise<number> {
    try {
      let query = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE room_id = $1`;
      const params = [roomId];
      
      if (status) {
        query += ` AND join_status = $2`;
        params.push(status);
      }
      
      const result = await this.db.queryOne(query, params);
      return parseInt(result?.count || '0');
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to count participants: ${error}`);
    }
  }

  /**
   * Create or update participant
   */
  async createOrUpdate(data: CreateParticipantData): Promise<RoomParticipant> {
    try {
      const existing = await this.findByRoomAndUser(data.roomId, data.userId);
      
      if (existing) {
        // Update existing participant (rejoining)
        return this.update(existing.id, {
          userName: data.userName,
          joinStatus: data.joinStatus || 'approved',
          leftAt: undefined // Clear left_at if rejoining
        });
      } else {
        // Create new participant
        return this.create({
          ...data,
          isHost: data.isHost || false,
          isMuted: false,
          isVideoOff: false,
          isScreenSharing: false,
          isHandRaised: false,
          joinStatus: data.joinStatus || 'approved',
          joinedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to create or update participant: ${error}`);
    }
  }

  /**
   * Update participant status
   */
  async updateParticipantStatus(roomId: string, userId: string, updates: UpdateParticipantData): Promise<RoomParticipant> {
    try {
      const participant = await this.findByRoomAndUser(roomId, userId);
      if (!participant) {
        throw DatabaseError.notFound('Participant not found');
      }
      
      return this.update(participant.id, updates);
    } catch (error) {
      if (error.message === 'Participant not found') {
        throw DatabaseError.notFound('Participant not found');
      }
      throw DatabaseError.queryFailed(`Failed to update participant status: ${error}`);
    }
  }

  /**
   * Remove participant from room
   */
  async removeParticipant(roomId: string, userId: string): Promise<void> {
    try {
      await this.updateParticipantStatus(roomId, userId, {
        joinStatus: 'removed',
        leftAt: new Date().toISOString()
      });
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to remove participant: ${error}`);
    }
  }

  /**
   * Log host action for audit trail
   */
  async logHostAction(actionData: HostActionData): Promise<void> {
    try {
      const id = this.generateId();
      const { roomId, hostId, targetUserId, actionType, reason } = actionData;
      const createdAt = new Date().toISOString();
      
      await this.db.execute(
        `INSERT INTO host_actions (id, room_id, host_id, target_user_id, action_type, reason, created_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, roomId, hostId, targetUserId, actionType, reason, createdAt]
      );
    } catch (error) {
      console.error('Failed to log host action:', error);
      // Don't throw error for audit logging failure
    }
  }

  /**
   * Get recent host actions for a room
   */
  async getRecentHostActions(roomId: string, limit: number = 50): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT ha.*, u.user_name as host_name, tu.user_name as target_name 
         FROM host_actions ha
         JOIN users u ON ha.host_id = u.id
         JOIN users tu ON ha.target_user_id = tu.id
         WHERE ha.room_id = $1
         ORDER BY ha.created_at DESC
         LIMIT $2`,
        [roomId, limit]
      );
      return result;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to get recent host actions: ${error}`);
    }
  }

  /**
   * Transfer host role
   */
  async transferHostRole(roomId: string, currentHostId: string, newHostId: string): Promise<void> {
    try {
      // Remove host role from current host
      await this.updateParticipantStatus(roomId, currentHostId, { isHost: false });
      
      // Give host role to new user
      await this.updateParticipantStatus(roomId, newHostId, { isHost: true });
      
      // Log the host transfer
      await this.logHostAction({
        roomId,
        hostId: currentHostId,
        targetUserId: newHostId,
        actionType: 'make_host'
      });
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to transfer host role: ${error}`);
    }
  }

  /**
   * Leave room (soft delete)
   */
  async leaveRoom(roomId: string, userId: string): Promise<void> {
    try {
      await this.updateParticipantStatus(roomId, userId, {
        leftAt: new Date().toISOString()
      });
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to leave room: ${error}`);
    }
  }
}

export default RoomParticipantRepository;