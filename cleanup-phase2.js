// Clean up existing Phase 2 tables if they exist
const { db } = require('./database.js');

if (db) {
  console.log('Cleaning up existing Phase 2 tables...');
  
  const tables = [
    'room_participants',
    'host_actions', 
    'meeting_reactions',
    'screen_sharing_sessions',
    'speaking_activity',
    'webrtc_signaling'
  ];
  
  tables.forEach(table => {
    try {
      db.exec(`DROP TABLE IF EXISTS ${table}`);
      console.log(`✅ Dropped table: ${table}`);
    } catch (error) {
      console.log(`⚠️  Could not drop ${table}: ${error.message}`);
    }
  });
  
  console.log('Cleanup completed!');
}