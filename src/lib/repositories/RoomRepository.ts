/**
 * Room repository for database operations
 */

import BaseRepository, { BaseEntity, DatabaseConnection } from './BaseRepository';
import { DatabaseError } from '@/lib/errors/ApiError';

/**
 * Room entity interface
 */
export interface Room extends BaseEntity {
  id: string;
  passcode: string;
  creator: string;
  creatorName: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Room creation data
 */
export interface CreateRoomData {
  passcode: string;
  creator: string;
  creatorName: string;
}

/**
 * Room update data
 */
export interface UpdateRoomData {
  passcode?: string;
  creatorName?: string;
}

/**
 * Room repository
 */
export class RoomRepository extends BaseRepository<Room> {
  protected tableName = 'rooms';
  protected entityName = 'Room';

  constructor(db: DatabaseConnection) {
    super(db);
  }

  /**
   * Find room by passcode
   */
  async findByPasscode(passcode: string): Promise<Room | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE passcode = $1 LIMIT 1`,
        [passcode]
      );
      return result.rows?.[0] || result[0] || null;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find room by passcode: ${error}`);
    }
  }

  /**
   * Find rooms by creator
   */
  async findByCreator(creator: string, limit: number = 50): Promise<Room[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE creator = $1 ORDER BY created_at DESC LIMIT $2`,
        [creator, limit]
      );
      return result.rows || result || [];
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find rooms by creator: ${error}`);
    }
  }

  /**
   * Check if passcode already exists
   */
  async passcodeExists(passcode: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `SELECT COUNT(*) as count FROM ${this.tableName} WHERE passcode = $1`,
        [passcode]
      );
      const count = parseInt(result.rows?.[0]?.count || result[0]?.count || '0');
      return count > 0;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to check passcode existence: ${error}`);
    }
  }

  /**
   * Generate unique room passcode
   */
  async generateUniquePasscode(length: number = 6): Promise<string> {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let passcode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      passcode = '';
      for (let i = 0; i < length; i++) {
        passcode += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      attempts++;
    } while (await this.passcodeExists(passcode) && attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      throw DatabaseError.queryFailed('Failed to generate unique room passcode after maximum attempts');
    }

    return passcode;
  }

  /**
   * Create room with unique passcode
   */
  async create(roomData: CreateRoomData): Promise<Room> {
    try {
      // Generate unique passcode if not provided
      let passcode = roomData.passcode;
      if (!passcode) {
        passcode = await this.generateUniquePasscode();
      } else {
        // Check if provided passcode already exists
        const exists = await this.passcodeExists(passcode);
        if (exists) {
          throw DatabaseError.uniqueConstraintViolation('passcode', 'Room with this passcode already exists');
        }
      }

      const now = new Date().toISOString();
      const room: Room = {
        id: this.generateId(),
        passcode,
        creator: roomData.creator,
        creatorName: roomData.creatorName,
        createdAt: now,
        updatedAt: now
      };

      const fields = ['id', 'passcode', 'creator', 'creator_name', 'created_at', 'updated_at'].join(', ');
      const placeholders = ['$1', '$2', '$3', '$4', '$5', '$6'].join(', ');
      const values = [room.id, room.passcode, room.creator, room.creatorName, room.createdAt, room.updatedAt];

      const result = await this.db.query(
        `INSERT INTO ${this.tableName} (${fields}) VALUES (${placeholders}) RETURNING *`,
        values
      );

      return result.rows?.[0] || result[0];
    } catch (error) {
      if (error.message?.includes('passcode') && error.message?.includes('already exists')) {
        throw DatabaseError.uniqueConstraintViolation('passcode', 'Room with this passcode already exists');
      }
      throw DatabaseError.queryFailed(`Failed to create room: ${error}`);
    }
  }

  /**
   * Update room
   */
  async update(id: string, roomData: UpdateRoomData): Promise<Room> {
    try {
      // If passcode is being updated, check if new passcode already exists
      if (roomData.passcode) {
        const existingRoom = await this.findByPasscode(roomData.passcode);
        if (existingRoom && existingRoom.id !== id) {
          throw DatabaseError.uniqueConstraintViolation('passcode', 'Passcode already in use by another room');
        }
      }

      const updateData: Partial<Room> = {
        ...roomData,
        updatedAt: new Date().toISOString()
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof Room] === undefined) {
          delete updateData[key as keyof Room];
        }
      });

      const fields = Object.keys(updateData)
        .map((key, index) => `${this.toSnakeCase(key)} = $${index + 2}`)
        .join(', ');
      const values = [id, ...Object.values(updateData)];

      const result = await this.db.query(
        `UPDATE ${this.tableName} SET ${fields} WHERE id = $1 RETURNING *`,
        values
      );

      if (!result.rows?.[0] && !result[0]) {
        throw new Error('Room not found');
      }

      return result.rows?.[0] || result[0];
    } catch (error) {
      if (error.message === 'Room not found') {
        throw DatabaseError.notFound('Room not found');
      }
      if (error.message?.includes('passcode') && error.message?.includes('already in use')) {
        throw DatabaseError.uniqueConstraintViolation('passcode', 'Passcode already in use by another room');
      }
      throw DatabaseError.queryFailed(`Failed to update room: ${error}`);
    }
  }

  /**
   * Get recent rooms created by a user
   */
  async getRecentRoomsByCreator(creator: string, limit: number = 10): Promise<Room[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE creator = $1 ORDER BY created_at DESC LIMIT $2`,
        [creator, limit]
      );
      return result.rows || result || [];
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to get recent rooms by creator: ${error}`);
    }
  }

  /**
   * Get total room count
   */
  async getTotalCount(): Promise<number> {
    try {
      const result = await this.db.query(`SELECT COUNT(*) as total FROM ${this.tableName}`);
      return parseInt(result.rows?.[0]?.total || result[0]?.total || '0');
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to count rooms: ${error}`);
    }
  }

  /**
   * Convert camelCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

export default RoomRepository;