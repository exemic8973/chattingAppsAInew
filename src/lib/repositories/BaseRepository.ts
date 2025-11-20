/**
 * Base repository class providing common CRUD operations
 * Implements the repository pattern for data access
 */

import { DatabaseError } from '@/lib/errors/ApiError';

/**
 * Base interface for all entities
 */
export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  query: (sql: string, params?: any[]) => Promise<any>;
  execute: (sql: string, params?: any[]) => Promise<any>;
  transaction: <T>(callback: (tx: any) => Promise<T>) => Promise<T>;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

/**
 * Pagination result
 */
export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Base repository class
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract tableName: string;
  protected abstract entityName: string;

  constructor(protected db: DatabaseConnection) {}

  /**
   * Find entity by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const result = await this.db.query(
        `SELECT * FROM ${this.tableName} WHERE id = $1 LIMIT 1`,
        [id]
      );
      return result.rows?.[0] || result[0] || null;
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find ${this.entityName} by ID: ${error}`);
    }
  }

  /**
   * Find all entities with optional pagination
   */
  async findAll(options: PaginationOptions = { page: 1, limit: 50 }): Promise<PaginationResult<T>> {
    try {
      const { page, limit, orderBy = 'created_at', orderDirection = 'DESC' } = options;
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await this.db.query(`SELECT COUNT(*) as total FROM ${this.tableName}`);
      const total = parseInt(countResult.rows?.[0]?.total || countResult[0]?.total || '0');

      // Get paginated data
      const dataResult = await this.db.query(
        `SELECT * FROM ${this.tableName} 
         ORDER BY ${orderBy} ${orderDirection} 
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      const data = dataResult.rows || dataResult || [];
      const totalPages = Math.ceil(total / limit);

      return {
        data: data as T[],
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to find all ${this.entityName}s: ${error}`);
    }
  }

  /**
   * Create new entity
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
      const id = this.generateId();
      const now = new Date().toISOString();
      
      const entity = {
        ...data,
        id,
        createdAt: now,
        updatedAt: now
      } as T;

      const fields = Object.keys(entity).join(', ');
      const placeholders = Object.keys(entity).map((_, index) => `$${index + 1}`).join(', ');
      const values = Object.values(entity);

      const result = await this.db.query(
        `INSERT INTO ${this.tableName} (${fields}) VALUES (${placeholders}) RETURNING *`,
        values
      );

      return result.rows?.[0] || result[0];
    } catch (error) {
      if (error instanceof Error && (error.message?.includes('unique constraint') || error.message?.includes('UNIQUE'))) {
        throw DatabaseError.uniqueConstraintViolation('email', `Failed to create ${this.entityName}: duplicate entry`);
      }
      throw DatabaseError.queryFailed(`Failed to create ${this.entityName}: ${error}`);
    }
  }

  /**
   * Update entity by ID
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    try {
      const now = new Date().toISOString();
      const updateData = { ...data, updatedAt: now };

      const fields = Object.keys(updateData)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      const values = [id, ...Object.values(updateData)];

      const result = await this.db.query(
        `UPDATE ${this.tableName} SET ${fields} WHERE id = $1 RETURNING *`,
        values
      );

      if (!result.rows?.[0] && !result[0]) {
        throw new Error(`${this.entityName} not found`);
      }

      return result.rows?.[0] || result[0];
    } catch (error) {
      if (error instanceof Error && error.message?.includes('not found')) {
        throw DatabaseError.notFound(`${this.entityName} not found`);
      }
      if (error instanceof Error && (error.message?.includes('unique constraint') || error.message?.includes('UNIQUE'))) {
        throw DatabaseError.uniqueConstraintViolation('email', `Failed to update ${this.entityName}: duplicate entry`);
      }
      throw DatabaseError.queryFailed(`Failed to update ${this.entityName}: ${error}`);
    }
  }

  /**
   * Delete entity by ID
   */
  async delete(id: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        `DELETE FROM ${this.tableName} WHERE id = $1 RETURNING id`,
        [id]
      );

      return !!(result.rows?.[0] || result[0]);
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to delete ${this.entityName}: ${error}`);
    }
  }

  /**
   * Count entities
   */
  async count(whereClause?: string, params?: any[]): Promise<number> {
    try {
      let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      if (whereClause) {
        query += ` WHERE ${whereClause}`;
      }

      const result = await this.db.query(query, params || []);
      return parseInt(result.rows?.[0]?.total || result[0]?.total || '0');
    } catch (error) {
      throw DatabaseError.queryFailed(`Failed to count ${this.entityName}s: ${error}`);
    }
  }

  /**
   * Execute query with custom SQL
   */
  async query(sql: string, params?: any[]): Promise<any> {
    try {
      return await this.db.query(sql, params);
    } catch (error) {
      throw DatabaseError.queryFailed(`Query failed: ${error}`);
    }
  }

  /**
   * Generate unique ID
   */
  protected generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Execute within transaction
   */
  async transaction<T>(callback: (repository: this) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      const transactionalRepo = Object.create(this);
      transactionalRepo.db = tx;
      return callback(transactionalRepo);
    });
  }
}

export default BaseRepository;