/**
 * Database migration utilities for SQLite to PostgreSQL
 * Provides tools for smooth migration when ready
 */

import { DatabaseManager } from '@/lib/database/DatabaseManager';
import { PostgreSQLConnection, migrateFromSQLiteToPostgreSQL } from './PostgreSQLConnection';
import { DatabaseError } from '@/lib/errors/ApiError';

/**
 * Database migration manager
 * Handles migration from SQLite to PostgreSQL
 */
export class DatabaseMigrationManager {
  private currentDatabase: 'sqlite' | 'postgresql';
  private postgreSQLConnection: PostgreSQLConnection | null = null;

  constructor() {
    // Determine current database type
    this.currentDatabase = this.detectCurrentDatabase();
    console.log('🗄️ Current database:', this.currentDatabase);
  }

  private detectCurrentDatabase(): 'sqlite' | 'postgresql' {
    // Check environment variables to determine current database
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('postgresql')) {
      return 'postgresql';
    }
    if (process.env.PGHOST && process.env.PGDATABASE) {
      return 'postgresql';
    }
    return 'sqlite';
  }

  /**
   * Check if migration is needed
   */
  isMigrationNeeded(): boolean {
    return this.currentDatabase === 'sqlite' && this.shouldMigrateToPostgreSQL();
  }

  private shouldMigrateToPostgreSQL(): boolean {
    // Migration needed if PostgreSQL is configured but we're still using SQLite
    return !!(process.env.DATABASE_URL || process.env.PGHOST);
  }

  /**
   * Prepare for PostgreSQL migration
   */
  async prepareForMigration(): Promise<void> {
    console.log('🔄 Preparing for PostgreSQL migration...');
    
    // Step 1: Backup current SQLite database
    await this.backupSQLiteDatabase();
    
    // Step 2: Create PostgreSQL connection
    this.postgreSQLConnection = new PostgreSQLConnection();
    
    // Step 3: Validate PostgreSQL connection
    const isHealthy = await this.postgreSQLConnection.isHealthy();
    if (!isHealthy) {
      throw new DatabaseError('PostgreSQL connection failed', 'CONNECTION_FAILED');
    }
    
    console.log('✅ PostgreSQL connection established');
  }

  /**
   * Backup current SQLite database
   */
  private async backupSQLiteDatabase(): Promise<void> {
    console.log('💾 Backing up SQLite database...');
    
    // Backup the current SQLite database
    const backupPath = 'chat-new-backup.db';
    const fs = require('fs');
    
    try {
      fs.copyFileSync('chat-new.db', backupPath);
      console.log('✅ SQLite database backed up to:', backupPath);
    } catch (error) {
      console.error('❌ Failed to backup SQLite database:', error);
      throw new DatabaseError('Failed to backup SQLite database', 'BACKUP_FAILED');
    }
  }

  /**
   * Perform migration to PostgreSQL
   */
  async migrateToPostgreSQL(): Promise<void> {
    console.log('🚀 Starting SQLite to PostgreSQL migration...');
    
    try {
      await this.prepareForMigration();
      await migrateFromSQLiteToPostgreSQL();
      console.log('✅ Migration completed successfully!');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw new DatabaseError('PostgreSQL migration failed', 'MIGRATION_FAILED');
    }
  }

  /**
   * Rollback to SQLite if migration fails
   */
  async rollbackToSQLite(): Promise<void> {
    console.log('🔄 Rolling back to SQLite...');
    
    // Restore from backup
    const fs = require('fs');
    
    try {
      if (fs.existsSync('chat-new-backup.db')) {
        fs.copyFileSync('chat-new-backup.db', 'chat-new.db');
        console.log('✅ Rolled back to SQLite from backup');
      } else {
        console.warn('⚠️ No SQLite backup found for rollback');
      }
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw new DatabaseError('Rollback to SQLite failed', 'ROLLBACK_FAILED');
    }
  }

  /**
   * Get migration status
   */
  getMigrationStatus(): {
    currentDatabase: 'sqlite' | 'postgresql';
    migrationNeeded: boolean;
    isHealthy: boolean;
  } {
    return {
      currentDatabase: this.currentDatabase,
      migrationNeeded: this.isMigrationNeeded(),
      isHealthy: this.postgreSQLConnection ? true : false
    };
  }
}

export default {
  DatabaseMigrationManager,
  migrateFromSQLiteToPostgreSQL
};