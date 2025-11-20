/**
 * Meeting Reaction Repository
 * Manages real-time reactions during meetings
 */

import { BaseRepository, BaseEntity } from '@/lib/database/BaseRepository';
import { DatabaseConnection } from '@/lib/database/DatabaseConnection';
import { DatabaseError } from '@/lib/errors/ApiError';

/**
 * Meeting Reaction entity interface
 */
export interface MeetingReaction extends BaseEntity {
  roomId: string;
  userId: string;
  userName: string;
  reactionType: '👍' | '❤️' | '😂' | '😮' | '🎉' | '👏';
  createdAt: string;
}

/**
 * Reaction creation data
 */
export interface CreateReactionData {
  roomId: string;
  userId: string;
  userName: string;
  reactionType: '👍' | '❤️' | '😂' | '😮' | '🎉' | '👏';
}

/**
 * Meeting Reaction repository
 */
export class MeetingReactionRepository extends BaseRepository<MeetingReaction> {
  protected tableName = 'meeting_reactions';
  protected entityName = 'MeetingReaction';

  constructor(db: DatabaseConnection) {
    super(db);
  }

  /**
   * Find reactions by room
   */
  async findByRoomId(roomId: string, limit: number = 100): Promise<MeetingReaction[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE room_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [roomId, limit]
      );
      return result.rows || [];
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find reactions by room: ${error}`);
    }
  }

  /**
   * Find reactions by user
   */
  async findByUserId(userId: string, limit: number = 50): Promise<MeetingReaction[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [userId, limit]
      );
      return result.rows || [];
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find reactions by user: ${error}`);
    }
  }

  /**
   * Get recent reactions for a room (with user info)
   */
  async getRecentReactions(roomId: string, limit: number = 50): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT mr.*, u.user_name
         FROM ${this.tableName} mr
         JOIN users u ON mr.user_id = u.id
         WHERE mr.room_id = $1
         ORDER BY mr.created_at DESC
         LIMIT $2`,
        [roomId, limit]
      );
      return result.rows || [];
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to get recent reactions: ${error}`);
    }
  }

  /**
   * Get reaction statistics for a room
   */
  async getReactionStats(roomId: string): Promise<{
    totalReactions: number;
    reactionsByType: Record<string, number>;
    topReactors: Array<{ userId: string; userName: string; reactionCount: number }>;
  }> {
    try {
      // Total reactions
      const totalResult = await this.queryOne(
        `SELECT COUNT(*) as total FROM ${this.tableName} WHERE room_id = $1`,
        [roomId]
      );
      const totalReactions = parseInt(totalResult?.total || '0');

      // Reactions by type
      const typeResult = await this.db.query(
        `SELECT reaction_type, COUNT(*) as count
         FROM ${this.tableName}
         WHERE room_id = $1
         GROUP BY reaction_type
         ORDER BY count DESC`,
        [roomId]
      );
      const reactionsByType: Record<string, number> = {};
      (typeResult.rows || []).forEach((row: any) => {
        reactionsByType[row.reaction_type] = parseInt(row.count);
      });

      // Top reactors
      const topReactorsResult = await this.db.query(
        `SELECT user_id, user_name, COUNT(*) as reaction_count
         FROM ${this.tableName}
         WHERE room_id = $1
         GROUP BY user_id, user_name
         ORDER BY reaction_count DESC
         LIMIT 10`,
        [roomId]
      );
      const topReactors = (topReactorsResult.rows || []).map((row: any) => ({
        userId: row.user_id,
        userName: row.user_name,
        reactionCount: parseInt(row.reaction_count)
      }));

      return {
        totalReactions,
        reactionsByType,
        topReactors
      };
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to get reaction statistics: ${error}`);
    }
  }

  /**
   * Create reaction with rate limiting
   */
  async createReaction(data: CreateReactionData): Promise<MeetingReaction> {
    try {
      // Check for rate limiting (max 10 reactions per minute per user)
      const recentCount = await this.queryOne(
        `SELECT COUNT(*) as count
         FROM ${this.tableName}
         WHERE user_id = $1 AND room_id = $2 AND created_at > datetime('now', '-1 minute')`,
        [data.userId, data.roomId]
      );
      
      if (parseInt(recentCount?.count || '0') >= 10) {
        throw DatabaseError.rateLimitExceeded('Too many reactions. Please wait a moment.');
      }

      return this.create({
        ...data
      });
    } catch (error) {
      if (error instanceof Error && error.message?.includes('Too many reactions')) {
        throw error;
      }
      throw DatabaseError.queryFailed(`Failed to create reaction: ${error}`);
    }
  }

  /**
   * Bulk create reactions (for importing or batch operations)
   */
  async bulkCreateReactions(reactions: CreateReactionData[]): Promise<MeetingReaction[]> {
    try {
      const results: MeetingReaction[] = [];
      
      for (const reaction of reactions) {
        const created = await this.createReaction(reaction);
        results.push(created);
      }
      
      return results;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to bulk create reactions: ${error}`);
    }
  }

  /**
   * Clean up old reactions (for maintenance)
   */
  async cleanupOldReactions(olderThanDays: number = 30): Promise<number> {
    try {
      const result = await this.db.execute(
        `DELETE FROM ${this.tableName} WHERE created_at < datetime('now', '-${olderThanDays} days')`,
        []
      );
      return result.rowCount;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to cleanup old reactions: ${error}`);
    }
  }

  /**
   * Get reaction timeline for a room
   */
  async getReactionTimeline(roomId: string, timeWindowMinutes: number = 60): Promise<any[]> {
    try {
      const result = await this.db.query(
        `SELECT
           strftime('%Y-%m-%d %H:%M:00', created_at) as time_bucket,
           reaction_type,
           COUNT(*) as count
         FROM ${this.tableName}
         WHERE room_id = $1 AND created_at > datetime('now', '-${timeWindowMinutes} minutes')
         GROUP BY time_bucket, reaction_type
         ORDER BY time_bucket DESC, count DESC`,
        [roomId]
      );
      return result.rows || [];
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to get reaction timeline: ${error}`);
    }
  }
}

export default MeetingReactionRepository;