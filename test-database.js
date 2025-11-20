const { DatabaseManager } = require('./src/lib/database/DatabaseManager');

async function testDatabase() {
  try {
    console.log('🧪 Testing database connection...');
    const dbManager = DatabaseManager.getInstance();
    const db = dbManager.getConnection();
    
    console.log('✅ Database manager initialized');
    
    // Test a simple query
    const result = await db.query('SELECT 1 as test');
    console.log('✅ Database query test:', result);
    
    // Test user table existence
    try {
      const users = await db.query('SELECT * FROM users LIMIT 1');
      console.log('✅ Users table accessible');
    } catch (error) {
      console.log('❌ Users table error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testDatabase();