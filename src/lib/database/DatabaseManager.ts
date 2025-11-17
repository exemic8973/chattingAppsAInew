/**
 * Database connection manager with pooling and transaction support
 * Handles both PostgreSQL (production) and SQLite (development)
 */

import { config } from '@/lib/config';
import { DatabaseError } from '@/lib/errors/ApiError';

// Import database drivers conditionally
let pg: any, Pool: any, Client: any;
let sqlite3: any, Database: any;

if (config.isProduction) {
  try {
    const pgModule = require('pg');
    pg = pgModule;
    Pool = pgModule.Pool;
    Client = pgModule.Client;
  } catch (error) {
    console.warn('PostgreSQL driver not available, falling back to SQLite');
  }
} else {
  try {
    const sqliteModule = require('better-sqlite3');
    sqlite3 = sqliteModule;
    Database = sqliteModule;
  } catch (error) {
    console.warn('SQLite driver not available');
  }
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
 * PostgreSQL connection implementation
 */
class PostgreSQLConnection implements DatabaseConnection {
  private pool: any;
  private client: any;

  constructor() {
    const dbConfig = config.getDatabaseConfig();
    const isLocalhost = this.isLocalhostConnection(dbConfig.url || dbConfig.getUrl());

    this.pool = new Pool({
      connectionString: dbConfig.url || dbConfig.getUrl(),
      max: dbConfig.pool.max,
      idleTimeoutMillis: dbConfig.pool.idleTimeoutMillis,
      connectionTimeoutMillis: dbConfig.pool.connectionTimeoutMillis,
      ssl: !isLocalhost ? { rejectUnauthorized: false } : false,
      statement_timeout: 5000,
      query_timeout: 5000
    });

    this.setupErrorHandling();
  }

  private isLocalhostConnection(connectionString: string): boolean {
    return connectionString.includes('localhost') || 
           connectionString.includes('127.0.0.1') ||
           connectionString.includes('::1');
  }

  private setupErrorHandling(): void {
    this.pool.on('error', (err: Error) => {
      console.error('PostgreSQL pool error:', err);
    });

    this.pool.on('connect', () => {
      console.log('PostgreSQL client connected');
    });

    this.pool.on('remove', () => {
      console.log('PostgreSQL client removed');
    });
  }

  async query(sql: string, params: any[] = []): Promise<any> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      throw this.handleError(error, sql, params);
    }
  }

  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      throw this.handleError(error, sql, params);
    }
  }

  async queryAll(sql: string, params: any[] = []): Promise<any[]> {
    return this.query(sql, params);
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    try {
      const result = await this.pool.query(sql, params);
      return { 
        changes: result.rowCount || 0,
        lastInsertRowid: result.rows[0]?.id || result.insertId
      };
    } catch (error) {
      throw this.handleError(error, sql, params);
    }
  }

  async beginTransaction(): Promise<DatabaseTransaction> {
    const client = await this.pool.connect();
    await client.query('BEGIN');
    return new PostgreSQLTransaction(client);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('PostgreSQL health check failed:', error);
      return false;
    }
  }

  private handleError(error: any, sql: string, params: any[]): DatabaseError {
    console.error('PostgreSQL query error:', {
      error: error.message,
      sql: sql.substring(0, 200), // Log first 200 chars of SQL
      params: params
    });

    if (error.code === '23505') { // Unique violation
      return DatabaseError.uniqueConstraintViolation(
        error.detail || 'Unique constraint violation',
        { sql, params, originalError: error }
      );
    }

    if (error.code === '23503') { // Foreign key violation
      return DatabaseError.foreignKeyViolation(
        error.detail || 'Foreign key constraint violation',
        { sql, params, originalError: error }
      );
    }

    if (error.code === '42703') { // Undefined column
      return DatabaseError.queryFailed(
        'Invalid column reference',
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
 * PostgreSQL transaction implementation
 */
class PostgreSQLTransaction implements DatabaseTransaction {
  constructor(private client: any) {}

  async query(sql: string, params: any[] = []): Promise<any> {
    const result = await this.client.query(sql, params);
    return result.rows;
  }

  async queryOne(sql: string, params: any[] = []): Promise<any | null> {
    const result = await this.client.query(sql, params);
    return result.rows[0] || null;
  }

  async queryAll(sql: string, params: any[] = []): Promise<any[]> {
    return this.query(sql, params);
  }

  async execute(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid?: number }> {
    const result = await this.client.query(sql, params);
    return { 
      changes: result.rowCount || 0,
      lastInsertRowid: result.rows[0]?.id || result.insertId
    };
  }

  async commit(): Promise<void> {
    await this.client.query('COMMIT');
    this.client.release();
  }

  async rollback(): Promise<void> {
    await this.client.query('ROLLBACK');
    this.client.release();
  }
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
class DatabaseManager {
  private static instance: DatabaseManager;
  private connection: DatabaseConnection;

  private constructor() {
    if (config.isProduction && pg) {
      this.connection = new PostgreSQLConnection();
    } else if (sqlite3) {
      this.connection = new SQLiteConnection();
    } else {
      throw new Error('No database driver available');
    }
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