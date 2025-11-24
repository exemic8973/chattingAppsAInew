// Debug the filtering logic
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'src/lib/database/migrations/phase2-schema-sqlite.sql');
const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

console.log('Testing filtering logic...');

const rawStatements = schemaSQL.split(';');
console.log('Raw statements after split:', rawStatements.length);

rawStatements.forEach((stmt, i) => {
  const trimmed = stmt.trim();
  const shouldInclude = trimmed.length > 0 && !trimmed.startsWith('--') && !trimmed.includes('CREATE INDEX') && trimmed.includes('CREATE TABLE');
  console.log(`Statement ${i + 1}: length=${trimmed.length}, startsWith(--)=${trimmed.startsWith('--')}, includes(CREATE INDEX)=${trimmed.includes('CREATE INDEX')}, includes(CREATE TABLE)=${trimmed.includes('CREATE TABLE')}, INCLUDE=${shouldInclude}`);
  if (shouldInclude) {
    console.log('  Content:', trimmed.substring(0, 100) + '...');
  }
});