// Check if Phase 2 tables were created
const { db } = require('./database.js');

if (db) {
  console.log('Checking Phase 2 tables...');
  
  const phase2Tables = [
    'room_participants',
    'host_actions', 
    'meeting_reactions',
    'screen_sharing_sessions',
    'speaking_activity',
    'webrtc_signaling'
  ];
  
  const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('All tables in database:', allTables.map(t => t.name));
  
  phase2Tables.forEach(table => {
    const exists = allTables.some(t => t.name === table);
    console.log(`${table}: ${exists ? '✅ EXISTS' : '❌ NOT FOUND'}`);
  });
}