/**
 * User repository implementation
 * Handles all user-related database operations
 */

import { BaseRepository, BaseEntity, PaginationOptions, PaginationResult } from '@/lib/database/BaseRepository';
import { DatabaseConnection } from '@/lib/database/DatabaseConnection';
import { DatabaseError } from '@/lib/errors/ApiError';
import bcrypt from 'bcryptjs';

// Import the legacy database functions for compatibility
const isProduction = process.env.NODE_ENV === 'production';
let userOps: any;

try {
  // Try to import the legacy database functions
  const legacyDb = require('../../../database.js');
  userOps = legacyDb.userOps;
} catch (error) {
  console.warn('Legacy database functions not available, using new interface');
}

/**
 * User entity interface
 */
export interface User extends BaseEntity {
  email: string;
  password: string;
  fullName: string;
}

/**
 * User creation data
 */
export interface CreateUserData {
  email: string;
  password: string;
  fullName: string;
}

/**
 * User update data
 */
export interface UpdateUserData {
  email?: string;
  password?: string;
  fullName?: string;
}

/**
 * User repository
 */
export class UserRepository extends BaseRepository<User> {
  protected tableName = 'users';
  protected entityName = 'User';

  constructor(db: DatabaseConnection) {
    super(db);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    try {
      const emailLower = email.toLowerCase();
      
      // Use legacy database functions if available for better compatibility
      if (userOps && userOps.findByEmail) {
        const legacyUser = await userOps.findByEmail(emailLower);
        if (legacyUser) {
          return {
            id: legacyUser.id,
            email: legacyUser.email,
            password: legacyUser.password,
            fullName: legacyUser.userName, // Legacy uses userName, map to fullName
            createdAt: legacyUser.createdAt
          };
        }
        return null;
      }

      // Fallback to new database interface
      const result = await this.queryOne(
        `SELECT * FROM ${this.tableName} WHERE email = ? LIMIT 1`,
        [emailLower]
      );
      
      if (result) {
        // Map database column names to JavaScript naming
        return {
          ...result,
          userName: result.user_name // Map database user_name to JavaScript userName
        };
      }
      
      return null;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find user by email: ${error}`);
    }
  }

  /**
   * Find user by email with password (for authentication)
   */
  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.findByEmail(email);
  }

  /**
   * Check if email already exists
   */
  async emailExists(email: string): Promise<boolean> {
    try {
      const emailLower = email.toLowerCase();
      
      // Use legacy database functions if available for better compatibility
      if (userOps && userOps.findByEmail) {
        const user = await userOps.findByEmail(emailLower);
        return !!user;
      }

      // Fallback to new database interface
      const result = await this.queryOne(
        `SELECT COUNT(*) as count FROM ${this.tableName} WHERE email = ?`,
        [emailLower]
      );
      return parseInt(result?.count || '0') > 0;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to check email existence: ${error}`);
    }
  }

  /**
   * Create user with password hashing
   */
  async create(data: CreateUserData): Promise<User> {
    try {
      // Check if email already exists
      const emailExists = await this.emailExists(data.email);
      if (emailExists) {
        throw DatabaseError.uniqueConstraintViolation('email', 'User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(data.password, 12);

      // Create user with proper ID generation
      const id = this.generateId();
      const now = new Date().toISOString();
      
      // Use legacy database functions if available for better compatibility
      if (userOps && userOps.create) {
        const legacyUser = await userOps.create({
          id,
          email: data.email.toLowerCase(),
          password: hashedPassword,
          userName: data.fullName.trim(), // Legacy uses userName but we pass fullName
          createdAt: now
        });
        
        return {
          id: legacyUser.id,
          email: legacyUser.email,
          password: legacyUser.password,
          fullName: data.fullName.trim(), // Map to new field name
          createdAt: legacyUser.createdAt
        };
      }

      // Fallback to new database interface
      const result = await this.db.execute(
        `INSERT INTO ${this.tableName} (id, email, password, user_name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, data.email.toLowerCase(), hashedPassword, data.fullName.trim(), now, now]
      );

      if (result.rowCount > 0) {
        // Return the created user
        return {
          id,
          email: data.email.toLowerCase(),
          password: hashedPassword,
          fullName: data.fullName.trim(),
          createdAt: now,
          updatedAt: now
        };
      }
      
      throw new Error('Failed to create user');
    } catch (error) {
      if (error instanceof Error && error.message?.includes('already exists')) {
        throw DatabaseError.uniqueConstraintViolation('email', 'User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Update user with optional password hashing
   */
  async update(id: string, data: UpdateUserData): Promise<User> {
    try {
      const updateData: any = { ...data };

      // Hash new password if provided
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 12);
      }

      // Normalize email if provided
      if (data.email) {
        updateData.email = data.email.toLowerCase();
      }

      // Map fullName to user_name for database
      if (data.fullName) {
        updateData.user_name = data.fullName.trim();
        delete updateData.fullName; // Remove JavaScript naming
      }

      // Use the base repository update method
      const updatedUser = await super.update(id, updateData);

      return updatedUser;
    } catch (error) {
      if (error instanceof Error && error.message?.includes('already exists')) {
        throw DatabaseError.uniqueConstraintViolation('email', 'Email already in use');
      }
      throw error;
    }
  }

  /**
   * Validate user password
   */
  async validatePassword(email: string, password: string): Promise<User | null> {
    try {
      const user = await this.findByEmailWithPassword(email);
      if (!user) {
        return null;
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return null;
      }

      return user;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to validate password: ${error}`);
    }
  }

  /**
   * Find users by partial email match (for search)
   */
  async findByEmailPartial(email: string, limit: number = 10): Promise<User[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE email LIKE $1 LIMIT $2`,
        [`%${email.toLowerCase()}%`, limit]
      );
      return result.rows || [];
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to search users by email: ${error}`);
    }
  }

  /**
   * Find users by partial username match (for search)
   */
  async findByUserNamePartial(userName: string, limit: number = 10): Promise<User[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE user_name LIKE $1 LIMIT $2`,
        [`%${userName}%`, limit]
      );
      return result.rows || [];
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to search users by username: ${error}`);
    }
  }

  /**
   * Get user statistics
   */
  async getStats(): Promise<{
    totalUsers: number;
    usersToday: number;
    usersThisWeek: number;
    usersThisMonth: number;
  }> {
    try {
      const [totalUsers, usersToday, usersThisWeek, usersThisMonth] = await Promise.all([
        this.count(),
        this.count('DATE(created_at) = CURRENT_DATE'),
        this.count('created_at >= CURRENT_DATE - INTERVAL \'7 days\''),
        this.count('created_at >= CURRENT_DATE - INTERVAL \'30 days\'')
      ]);

      return {
        totalUsers,
        usersToday,
        usersThisWeek,
        usersThisMonth
      };
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to get user statistics: ${error}`);
    }
  }

  /**
   * Create user with transaction
   */
  async createWithTransaction(data: CreateUserData): Promise<User> {
    return this.transaction(async (repo) => {
      // Check if email exists within transaction
      const emailExists = await repo.emailExists(data.email);
      if (emailExists) {
        throw DatabaseError.uniqueConstraintViolation('email', 'User with this email already exists');
      }

      // Create user
      return repo.create(data);
    });
  }

  /**
   * Soft delete user (mark as deleted instead of removing)
   */
  async softDelete(id: string): Promise<User> {
    try {
      // In a real implementation, you might add a deleted_at field
      // For now, just update the updatedAt timestamp (set automatically by update)
      return this.update(id, {});
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to soft delete user: ${error}`);
    }
  }

  /**
   * Get user by ID without password
   */
  async findByIdSafe(id: string): Promise<Omit<User, 'password'> | null> {
    try {
      const result = await this.queryOne(
        `SELECT id, email, user_name, created_at, updated_at FROM ${this.tableName} WHERE id = $1 LIMIT 1`,
        [id]
      );
      return result;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find user by ID (safe): ${error}`);
    }
  }

  /**
   * Get all users without passwords
   */
  async findAllSafe(options: PaginationOptions = { page: 1, limit: 50 }): Promise<PaginationResult<Omit<User, 'password'>>> {
    try {
      const { page, limit, orderBy = 'created_at', orderDirection = 'DESC' } = options;
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await this.queryOne(`SELECT COUNT(*) as total FROM ${this.tableName}`);
      const total = parseInt(countResult?.total || '0');

      // Get paginated data (without password)
      const dataResult = await this.db.query(
        `SELECT id, email, user_name, created_at, updated_at 
         FROM ${this.tableName} 
         ORDER BY ${orderBy} ${orderDirection} 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const data = dataResult.rows || [];
      const totalPages = Math.ceil(total / limit);

      return {
        data: data as Omit<User, 'password'>[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find all users (safe): ${error}`);
    }
  }
}

export default UserRepository;