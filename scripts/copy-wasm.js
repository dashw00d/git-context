const fs = require('fs');
const path = require('path');

// sql.js is in root node_modules, not scripts/node_modules
const src = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
const dest = path.join(__dirname, '..', 'out', 'wasm', 'sql-wasm.wasm');

console.log(`Copying ${src} to ${dest}...`);

if (fs.existsSync(src)) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log('Successfully copied sql-wasm.wasm');
} else {
  console.error('Error: sql-wasm.wasm not found in node_modules');
  process.exit(1);
}