// Debug SQL parsing more carefully
const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'src/lib/database/migrations/phase2-schema-sqlite.sql');
const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

console.log('SQL content (showing line endings):');
const lines = schemaSQL.split('\n');
lines.forEach((line, i) => {
  // Show line endings
  const lineEnding = line.includes('\r') ? 'CRLF' : 'LF';
  console.log(`${i + 1}: [${lineEnding}] ${line}`);
  if (i > 20) { // Just show first 20 lines
    console.log('... (truncated)');
    return;
  }
});

console.log('\nTesting different split approaches:');

// Test 1: Simple split on semicolon
const test1 = schemaSQL.split(';');
console.log('Test 1 (split on ;):', test1.length, 'parts');

// Test 2: Split on semicolon + newline
const test2 = schemaSQL.split(';\n');
console.log('Test 2 (split on ;\\n):', test2.length, 'parts');

// Test 3: Split on semicolon + optional whitespace + newline
const test3 = schemaSQL.split(/;\s*\n/);
console.log('Test 3 (split on ;\\s*\\n):', test3.length, 'parts');

// Test 4: Split on semicolon + optional whitespace + optional CR + LF
const test4 = schemaSQL.split(/;\s*(?:\r?\n)/);
console.log('Test 4 (split on ;\\s*(?:\\r?\\n):', test4.length, 'parts');