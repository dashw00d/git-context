#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findFilesWithShebang(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findFilesWithShebang(filePath, fileList);
    } else if (file.endsWith('.js')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.startsWith('#!/usr/bin/env')) {
          fileList.push(filePath);
        }
      } catch (err) {
        // Ignore read errors
      }
    }
  });

  return fileList;
}

function main() {
  const outDir = path.join(__dirname, '..', 'out');

  if (!fs.existsSync(outDir)) {
    console.log('out/ directory does not exist, skipping permission setup');
    return;
  }

  const files = findFilesWithShebang(outDir);

  if (files.length === 0) {
    console.log('No files with shebangs found');
    return;
  }

  files.forEach(file => {
    try {
      fs.chmodSync(file, 0o755);
      console.log(`Set executable permissions: ${file}`);
    } catch (err) {
      console.error(`Failed to set permissions on ${file}:`, err.message);
    }
  });

  console.log(`✓ Set executable permissions on ${files.length} file(s)`);
}

main();
