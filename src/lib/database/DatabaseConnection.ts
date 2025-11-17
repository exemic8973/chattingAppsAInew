/**
 * Database connection wrapper
 * Provides unified interface for PostgreSQL and SQLite operations
 */

import { config } from '@/lib/config';
import { DatabaseError } from '@/lib/errors/ApiError';

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount?: number }>;
  execute(sql: string, params?: any[]): Promise<{ rowCount: number }>;
  transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/**
 * PostgreSQL connection implementation
 */
export class PostgreSQLConnection implements DatabaseConnection {
  private pool: any;

  constructor(pool: any) {
    this.pool = pool;
  }

  async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount?: number }> {
    try {
      const result = await this.pool.query(sql, params);
      return { rows: result.rows, rowCount: result.rowCount };
    } catch (error) {
      throw DatabaseError.queryFailed(`PostgreSQL query failed: ${error.message}`);
    }
  }

  async execute(sql: string, params?: any[]): Promise<{ rowCount: number }> {
    try {
      const result = await this.pool.query(sql, params);
      return { rowCount: result.rowCount };
    } catch (error) {
      throw DatabaseError.queryFailed(`PostgreSQL execute failed: ${error.message}`);
    }
  }

  async transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const transactionalConnection = new PostgreSQLConnection({
        query: async (sql: string, params?: any[]) => {
          const result = await client.query(sql, params);
          return { rows: result.rows, rowCount: result.rowCount };
        },
        execute: async (sql: string, params?: any[]) => {
          const result = await client.query(sql, params);
          return { rowCount: result.rowCount };
        }
      } as any);

      const result = await callback(transactionalConnection);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

/**
 * SQLite connection implementation
 */
export class SQLiteConnection implements DatabaseConnection {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  async query(sql: string, params?: any[]): Promise<{ rows: any[]; rowCount?: number }> {
    try {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.all(...params) : stmt.all();
      return { rows: result || [], rowCount: result?.length || 0 };
    } catch (error) {
      throw DatabaseError.queryFailed(`SQLite query failed: ${error.message}`);
    }
  }

  async execute(sql: string, params?: any[]): Promise<{ rowCount: number }> {
    try {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.run(...params) : stmt.run();
      return { rowCount: result.changes };
    } catch (error) {
      throw DatabaseError.queryFailed(`SQLite execute failed: ${error.message}`);
    }
  }

  async transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
    try {
      this.db.exec('BEGIN TRANSACTION');
      
      const transactionalConnection = new SQLiteConnection(this.db);
      const result = await callback(transactionalConnection);
      
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * Database connection factory
 */
export class DatabaseConnectionFactory {
  private static instance: DatabaseConnection;

  static getInstance(): DatabaseConnection {
    if (!this.instance) {
      this.instance = this.createConnection();
    }
    return this.instance;
  }

  private static createConnection(): DatabaseConnection {
    const isProduction = config.isProduction;

    if (isProduction) {
      // PostgreSQL connection
      const { Pool } = require('pg');
      const dbHost = process.env.PGHOST || process.env.DB_HOST || 'localhost';
      const isLocalhost = dbHost === 'localhost' || dbHost === '127.0.0.1' ||
                          config.database.url?.includes('localhost') ||
                          config.database.url?.includes('127.0.0.1');

      const pool = new Pool({
        connectionString: config.database.getUrl(),
        host: dbHost,
        port: parseInt(process.env.PGPORT || process.env.DB_PORT || '5432'),
        database: process.env.PGDATABASE || process.env.DB_NAME || 'chatapp',
        user: process.env.PGUSER || process.env.DB_USER || 'postgres',
        password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
        max: config.database.pool.max,
        idleTimeoutMillis: config.database.pool.idleTimeoutMillis,
        connectionTimeoutMillis: config.database.pool.connectionTimeoutMillis,
        ssl: !isLocalhost ? { rejectUnauthorized: false } : false
      });

      return new PostgreSQLConnection(pool);
    } else {
      // SQLite connection
      const Database = require('better-sqlite3');
      const db = new Database('chat-new.db');
      return new SQLiteConnection(db);
    }
  }
}

/**
 * Database service singleton
 */
export const db = DatabaseConnectionFactory.getInstance();

export default {
  DatabaseConnection,
  PostgreSQLConnection,
  SQLiteConnection,
  DatabaseConnectionFactory,
  db
};