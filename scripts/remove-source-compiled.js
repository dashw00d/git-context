// Use this script to remove all .js files in the src directory that have a corresponding .ts file.


// node scripts/remove-source-compiled.js


const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');

function findJsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findJsFiles(filePath, fileList);
    } else if (file.endsWith('.js')) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function main() {
  console.log(`Scanning ${srcDir} for duplicate .js files...\n`);

  const jsFiles = findJsFiles(srcDir);
  let deletedCount = 0;
  let skippedCount = 0;

  for (const jsFile of jsFiles) {
    const dir = path.dirname(jsFile);
    const basename = path.basename(jsFile, '.js');
    const tsFile = path.join(dir, `${basename}.ts`);

    if (fs.existsSync(tsFile)) {
      // Both .js and .ts exist - delete the .js file
      const relativePath = path.relative(projectRoot, jsFile);
      console.log(`Deleting: ${relativePath} (matching .ts file exists)`);
      fs.unlinkSync(jsFile);
      deletedCount++;
    } else {
      // .js file exists but no matching .ts - keep it
      const relativePath = path.relative(projectRoot, jsFile);
      console.log(`Keeping: ${relativePath} (no matching .ts file)`);
      skippedCount++;
    }
  }

  console.log(`\nSummary:`);
  console.log(`  Deleted: ${deletedCount} .js file(s)`);
  console.log(`  Kept: ${skippedCount} .js file(s)`);
}

main();