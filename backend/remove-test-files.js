const fs = require('fs');
const path = require('path');

const testFiles = [
  'test-analytics.js',
  'test-grace-period.js',
  'test-login.js',
  'test-quotes.js',
  'test-system.js'
];

console.log('🗑️  Removing test files from production build...\n');

let deletedCount = 0;

testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`✓ Deleted: ${file}`);
    deletedCount++;
  } else {
    console.log(`⊘ Not found: ${file}`);
  }
});

console.log(`\n✅ Removed ${deletedCount} test files from production build`);
