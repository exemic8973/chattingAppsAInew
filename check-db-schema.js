const Database = require('better-sqlite3');

function checkDatabase() {
  try {
    console.log('🧪 Checking SQLite database...');
    const db = new Database('chat-new.db');
    
    // Check if users table exists
    const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('📊 Tables found:', tableInfo.map(t => t.name));
    
    // Check users table structure
    if (tableInfo.some(t => t.name === 'users')) {
      const columns = db.prepare("PRAGMA table_info(users)").all();
      console.log('👤 Users table columns:');
      columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type} (${col.notnull ? 'NOT NULL' : 'NULL'})`);
      });
      
      // Try to insert a test user
      try {
        const stmt = db.prepare('INSERT INTO users (email, password, userName) VALUES (?, ?, ?)');
        const result = stmt.run('test@example.com', 'hashedpassword', 'testuser');
        console.log('✅ Test user inserted:', result.lastInsertRowid);
        
        // Clean up
        db.prepare('DELETE FROM users WHERE email = ?').run('test@example.com');
        console.log('🧹 Test user cleaned up');
        
      } catch (error) {
        console.log('❌ Insert test failed:', error.message);
      }
      
      // Check existing users
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
      console.log('👥 Total users:', userCount.count);
      
    } else {
      console.log('❌ Users table does not exist');
    }
    
    db.close();
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

checkDatabase();