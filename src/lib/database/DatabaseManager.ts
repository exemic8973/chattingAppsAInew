/**
 * Database connection manager with pooling and transaction support
 * Handles both PostgreSQL (production) and SQLite (development)
 */

import { config } from '@/lib/config';
import { DatabaseError } from '@/lib/errors/ApiError';
import { PostgreSQLConnection, postgreSQLConfig } from './PostgreSQLConnection';

// Import database drivers conditionally
let pg: any, Pool: any, Client: any;
let sqlite3: any, Database: any;

// Track which database driver is available
let availableDatabase: 'postgresql' | 'sqlite' | 'none' = 'none';

if (config.isProduction) {
  try {
    // Check if PostgreSQL is configured
    if (process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGDATABASE)) {
      console.log('🗄️ PostgreSQL configured for production');
      availableDatabase = 'postgresql';
    } else {
      console.log('⚠️ PostgreSQL not configured, checking SQLite...');
    }
    
    if (availableDatabase === 'postgresql') {
      try {
        const pgModule = require('pg');
        pg = pgModule;
        Pool = pgModule.Pool;
        Client = pgModule.Client;
        console.log('✅ PostgreSQL driver loaded');
      } catch (error) {
        console.warn('❌ PostgreSQL driver not available:', error);
        availableDatabase = 'none';
      }
    }
  } catch (error) {
    console.warn('❌ PostgreSQL configuration error:', error);
  }
}

// Fallback to SQLite if PostgreSQL not available or for development
if (availableDatabase !== 'postgresql') {
  try {
    const sqliteModule = require('better-sqlite3');
    sqlite3 = sqliteModule;
    Database = sqliteModule;
    availableDatabase = 'sqlite';
    console.log('✅ SQLite driver loaded');
  } catch (error) {
    console.warn('❌ SQLite driver not available:', error);
    availableDatabase = 'none';
  }
}

if (availableDatabase === 'none') {
  console.error('❌ No database drivers available');
}

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<any>;
  queryOne(sql: string, params?: any[]): Promise<any | null>;
  queryAll(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  beginTransaction(): Promise<DatabaseTransaction>;
  close(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

/**
 * Database transaction interface
 */
export interface DatabaseTransaction {
  query(sql: string, params?: any[]): Promise<any>;
  queryOne(sql: string, params?: any[]): Promise<any | null>;
  queryAll(sql: string, params?: any[]): Promise<any[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}



/**
 * SQLite connection implementation
 */
class SQLiteConnection implements DatabaseConnection {
  private db: any;

  constructor() {
    try {
      this.db = new Database('chat-new.db');
      this.db.pragma('journal_mode = WAL');
      console.log('✅ SQLite database connected: chat-new.db');
    } catch (error) {
      throw DatabaseError.connectionFailed('Failed to connect to SQLite database');
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      throw this.handleError(error, sql, params);
    }
  }

  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) || null;
    } catch (error) {
      throw this.handleError(error, sql, params);
    }
  }

  async queryAll(sql: string, params: any[] = []): Promise<any[]> {
    return this.query(sql, params);
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return { 
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid
      };
    } catch (error) {
      throw this.handleError(error, sql, params);
    }
  }

  async beginTransaction(): Promise<DatabaseTransaction> {
    return new SQLiteTransaction(this.db);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async isHealthy(): Promise<boolean> {
    try {
      this.db.prepare('SELECT 1').get();
      return true;
    } catch (error) {
      console.error('SQLite health check failed:', error);
      return false;
    }
  }

  private handleError(error: any, sql: string, params: any[]): DatabaseError {
    console.error('SQLite query error:', {
      error: error.message,
      sql: sql.substring(0, 200),
      params: params
    });

    if (error.message.includes('UNIQUE constraint failed')) {
      return DatabaseError.uniqueConstraintViolation(
        'Unique constraint violation',
        { sql, params, originalError: error }
      );
    }

    if (error.message.includes('FOREIGN KEY constraint failed')) {
      return DatabaseError.foreignKeyViolation(
        'Foreign key constraint violation',
        { sql, params, originalError: error }
      );
    }

    return DatabaseError.queryFailed(
      error.message || 'Database query failed',
      { sql, params, originalError: error }
    );
  }
}

/**
 * SQLite transaction implementation
 */
class SQLiteTransaction implements DatabaseTransaction {
  constructor(private db: any) {
    this.db.prepare('BEGIN').run();
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params) || null;
  }

  async queryAll(sql: string, params: any[] = []): Promise<any[]> {
    return this.query(sql, params);
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...params);
    return { 
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid
    };
  }

  async commit(): Promise<void> {
    this.db.prepare('COMMIT').run();
  }

  async rollback(): Promise<void> {
    this.db.prepare('ROLLBACK').run();
  }
}

/**
 * Database manager singleton
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private connection: DatabaseConnection;
  private databaseType: 'postgresql' | 'sqlite';

  constructor() {
    this.databaseType = this.detectDatabaseType();
    
    if (this.databaseType === 'postgresql') {
      this.connection = new PostgreSQLConnection();
    } else if (this.databaseType === 'sqlite') {
      this.connection = new SQLiteConnection();
    } else {
      throw new Error('No database drivers available');
    }
  }

  private detectDatabaseType(): 'postgresql' | 'sqlite' {
    // Check if PostgreSQL is configured for production
    if (config.isProduction && (process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGDATABASE))) {
      return 'postgresql';
    }
    return 'sqlite';
  }

  /**
   * Get current database type
   */
  getDatabaseType(): 'postgresql' | 'sqlite' {
    return this.databaseType;
  }

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  getConnection(): DatabaseConnection {
    return this.connection;
  }

  async healthCheck(): Promise<boolean> {
    try {
      return await this.connection.isHealthy();
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}

// Export singleton instance and types
export const databaseManager = DatabaseManager.getInstance();
export const db = databaseManager.getConnection();

export default {
  databaseManager,
  db,
  DatabaseManager
};