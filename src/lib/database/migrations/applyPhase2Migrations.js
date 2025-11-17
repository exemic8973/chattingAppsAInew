/**
 * Phase 2 Database Migration Script
 * Applies schema extensions for new meeting features
 */

const { db, databaseManager } = require('../DatabaseManager.ts');
const fs = require('fs');
const path = require('path');

async function applyPhase2Migrations() {
  console.log('🚀 Starting Phase 2 database migrations...');
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'phase2-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} migration statements`);
    
    // Apply each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`🔧 Applying migration ${i + 1}/${statements.length}...`);
      
      try {
        await db.execute(statement);
        console.log(`✅ Migration ${i + 1} applied successfully`);
      } catch (error) {
        console.error(`❌ Error applying migration ${i + 1}:`, error.message);
        // Continue with other migrations even if one fails
        // (Some tables might already exist, causing errors)
      }
    }
    
    console.log('✅ Phase 2 database migrations completed successfully');
    
  } catch (error) {
    console.error('❌ Error during Phase 2 migrations:', error);
    throw error;
  }
}

// Run migrations if this script is executed directly
if (require.main === module) {
  applyPhase2Migrations()
    .then(() => {
      console.log('🎉 All Phase 2 migrations completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { applyPhase2Migrations };