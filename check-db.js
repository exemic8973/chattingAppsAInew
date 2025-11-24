// Check current database structure
const { db, pool } = require('./database.js');

if (db) {
  console.log('Using SQLite database');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Current tables:', tables.map(t => t.name));
} else if (pool) {
  console.log('Using PostgreSQL database');
  // For PostgreSQL, we'd need to query information_schema
} else {
  console.log('No database connection found');
}