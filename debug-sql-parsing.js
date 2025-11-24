// Debug SQL parsing
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'src/lib/database/migrations/phase2-schema-sqlite.sql');
const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

console.log('Original SQL length:', schemaSQL.length);
console.log('First 500 characters:');
console.log(schemaSQL.substring(0, 500));

// Test the parsing logic
const statements = schemaSQL
  .split(/;\s*(?:\r?\n)/) // Split on semicolon followed by optional CR and LF
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.includes('CREATE INDEX'));

console.log('\nParsed statements:', statements.length);
statements.forEach((stmt, i) => {
  console.log(`Statement ${i + 1}:`, stmt.substring(0, 100) + '...');
});