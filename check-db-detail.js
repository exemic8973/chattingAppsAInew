// Check current database structure in detail
const { db } = require('./database.js');

if (db) {
  console.log('Using SQLite database');
  
  // Get table schema
  const tables = ['users', 'rooms', 'messages'];
  
  tables.forEach(table => {
    console.log(`\n=== Table: ${table} ===`);
    try {
      const schema = db.prepare(`PRAGMA table_info(${table})`).all();
      schema.forEach(col => {
        console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
      });
    } catch (error) {
      console.log(`  Error getting schema: ${error.message}`);
    }
  });
  
  // Check existing data
  console.log('\n=== Sample Data ===');
  try {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log(`Users: ${userCount.count}`);
    
    const roomCount = db.prepare('SELECT COUNT(*) as count FROM rooms').get();
    console.log(`Rooms: ${roomCount.count}`);
    
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();
    console.log(`Messages: ${messageCount.count}`);
  } catch (error) {
    console.log(`Error checking data: ${error.message}`);
  }
}