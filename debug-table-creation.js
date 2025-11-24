// Debug: Try to create one table manually
const { db } = require('./database.js');

if (db) {
  console.log('Testing single table creation...');
  
  try {
    const sql = `CREATE TABLE IF NOT EXISTS room_participants (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  is_muted BOOLEAN DEFAULT FALSE,
  is_video_off BOOLEAN DEFAULT FALSE,
  is_screen_sharing BOOLEAN DEFAULT FALSE,
  is_hand_raised BOOLEAN DEFAULT FALSE,
  join_status TEXT DEFAULT 'approved' CHECK (join_status IN ('waiting', 'approved', 'rejected', 'removed')),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE(room_id, user_id)
);`;
    
    console.log('Executing SQL...');
    db.exec(sql);
    console.log('✅ Table created successfully!');
    
    // Verify
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Tables after creation:', tables.map(t => t.name));
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message);
    console.error('Full error:', error);
  }
}