/**
 * Simple Phase 2 Database Integration Script
 * Uses existing database.js to apply Phase 2 schema migrations
 */

const fs = require('fs');
const path = require('path');

// Import the existing database setup
const { db, pool } = require('./database.js');

async function integratePhase2Features() {
  console.log('🚀 Starting Phase 2 Database Integration...\n');
  
  try {
    // Read the schema file (use SQLite-compatible version)
    const schemaPath = path.join(__dirname, 'src/lib/database/migrations/phase2-schema-sqlite.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('📋 Phase 2 Schema SQL loaded successfully');
    
    // Split into individual statements - better approach
    const rawStatements = schemaSQL.split(';');
    const statements = [];
    
    for (let i = 0; i < rawStatements.length; i++) {
      const stmt = rawStatements[i].trim();
      if (stmt.length === 0) continue;
      
      // Skip pure comment lines and index statements
      if (stmt.startsWith('--') && !stmt.includes('CREATE TABLE')) continue;
      if (stmt.includes('CREATE INDEX')) continue;
      
      // If this is a comment that contains a CREATE TABLE, include it
      if (stmt.includes('CREATE TABLE')) {
        statements.push(stmt);
      }
    }
    
    console.log(`🔧 Found ${statements.length} migration statements to apply\n`);
    
    // Apply each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`🔧 Applying migration ${i + 1}/${statements.length}...`);
      
      try {
        if (db) {
          // SQLite (development)
          db.exec(statement);
        } else if (pool) {
          // PostgreSQL (production)
          await pool.query(statement);
        }
        console.log(`✅ Migration ${i + 1} applied successfully`);
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⚠️  Migration ${i + 1} skipped (already exists)`);
        } else {
          console.error(`❌ Error applying migration ${i + 1}:`, error.message);
          // Continue with other migrations even if one fails
        }
      }
    }
    
    // Apply CREATE INDEX statements separately
    console.log('\n🔧 Applying index statements...');
    const indexStatements = schemaSQL
      .split('\n')
      .filter(line => line.trim().startsWith('CREATE INDEX'))
      .map(line => line.trim().replace(/;$/, ''));
    
    for (let i = 0; i < indexStatements.length; i++) {
      const statement = indexStatements[i];
      try {
        if (db) {
          db.exec(statement);
        } else if (pool) {
          await pool.query(statement);
        }
        console.log(`✅ Index ${i + 1}/${indexStatements.length} created`);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  Index ${i + 1} skipped (already exists)`);
        } else {
          console.error(`❌ Error creating index ${i + 1}:`, error.message);
        }
      }
    }
    
    console.log('\n✅ Phase 2 Database Integration completed successfully!');
    console.log('\n📋 Summary of new database tables created:');
    console.log('  ✅ room_participants - Enhanced participant management');
    console.log('  ✅ host_actions - Audit trail for host actions');
    console.log('  ✅ meeting_reactions - Reaction storage and analytics');
    console.log('  ✅ screen_sharing_sessions - Screen share tracking');
    console.log('  ✅ speaking_activity - Speaking analytics');
    console.log('  ✅ webrtc_signaling - Enhanced signaling logs');
    
    // Verify the migrations by checking if tables exist
    await verifyMigrations();
    
  } catch (error) {
    console.error('❌ Phase 2 Database Integration failed:', error);
    throw error;
  }
}

async function verifyMigrations() {
  console.log('\n🔍 Verifying database migrations...');
  
  const tables = [
    'room_participants',
    'host_actions', 
    'meeting_reactions',
    'screen_sharing_sessions',
    'speaking_activity',
    'webrtc_signaling'
  ];
  
  for (const table of tables) {
    try {
      if (db) {
        // SQLite check
        const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
        if (result) {
          console.log(`✅ Table '${table}' exists`);
        } else {
          console.log(`❌ Table '${table}' not found`);
        }
      } else if (pool) {
        // PostgreSQL check
        const result = await pool.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`, [table]);
        if (result.rows[0].exists) {
          console.log(`✅ Table '${table}' exists`);
        } else {
          console.log(`❌ Table '${table}' not found`);
        }
      }
    } catch (error) {
      console.log(`⚠️  Could not verify table '${table}':`, error.message);
    }
  }
  
  console.log('\n🎉 Database verification completed!');
}

// Run integration if called directly
if (require.main === module) {
  integratePhase2Features()
    .then(() => {
      console.log('\n🎉 Phase 2 Database Integration completed successfully!');
      console.log('\n🚀 Next steps:');
      console.log('  1. Restart your Next.js development server');
      console.log('  2. Test the new API endpoints');
      console.log('  3. Integrate the new socket events into your frontend');
      console.log('  4. Test multi-party video calls');
      console.log('\n📚 Backend features ready for frontend integration!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Phase 2 Integration failed:', error);
      process.exit(1);
    });
}

module.exports = { integratePhase2Features };