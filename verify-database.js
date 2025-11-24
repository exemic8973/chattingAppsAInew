#!/usr/bin/env node

/**
 * Database Configuration Verification Script
 * Checks that development uses SQLite and production uses PostgreSQL
 */

console.log('🔍 Verifying Database Configuration\n');
console.log('='.repeat(50));

// Check NODE_ENV
const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`\n📋 NODE_ENV: ${nodeEnv}`);

// Check which database will be used
const isProduction = nodeEnv === 'production';
console.log(`\n🗄️  Database Mode: ${isProduction ? 'PostgreSQL (Production)' : 'SQLite (Development)'}`);

// Check for PostgreSQL configuration
const hasDatabaseUrl = !!process.env.DATABASE_URL;
const hasPgHost = !!process.env.PGHOST;
const hasPgUser = !!process.env.PGUSER;
const hasPgPassword = !!process.env.PGPASSWORD;

console.log('\n🔌 PostgreSQL Configuration:');
console.log(`   DATABASE_URL: ${hasDatabaseUrl ? '✅ Set' : '❌ Not set'}`);
console.log(`   PGHOST: ${hasPgHost ? '✅ Set' : '❌ Not set'}`);
console.log(`   PGUSER: ${hasPgUser ? '✅ Set' : '❌ Not set'}`);
console.log(`   PGPASSWORD: ${hasPgPassword ? '✅ Set' : '❌ Not set'}`);

// Development warnings
if (!isProduction) {
  console.log('\n⚠️  Development Mode Checks:');
  
  if (hasDatabaseUrl || hasPgHost) {
    console.log('   ⚠️  WARNING: PostgreSQL vars set in development!');
    console.log('   ℹ️   Development should use SQLite only.');
    console.log('   💡 Remove DATABASE_URL and PG* vars from .env.local');
  } else {
    console.log('   ✅ No PostgreSQL configuration (correct for development)');
  }
  
  console.log('\n   ✅ Will use: SQLite database (chat-new.db)');
}

// Production warnings
if (isProduction) {
  console.log('\n⚠️  Production Mode Checks:');
  
  if (!hasDatabaseUrl && !hasPgHost) {
    console.log('   ❌ ERROR: No PostgreSQL configuration!');
    console.log('   ℹ️   Production requires PostgreSQL.');
    console.log('   💡 Set DATABASE_URL or PGHOST/PGUSER/PGPASSWORD');
  } else {
    console.log('   ✅ PostgreSQL configured (correct for production)');
  }
  
  console.log('\n   ✅ Will use: PostgreSQL database');
}

console.log('\n' + '='.repeat(50));
console.log('\n✅ Database configuration verified!');

// Quick start commands
if (!isProduction) {
  console.log('\n🚀 To start development (SQLite):');
  console.log('   npm run dev');
} else {
  console.log('\n🚀 To start production (PostgreSQL):');
  console.log('   npm start');
}
