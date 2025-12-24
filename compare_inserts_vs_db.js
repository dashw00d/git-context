const fs = require('fs');
const path = require('path');

// Find the most recent files
const sandboxDir = path.join(__dirname, 'tests/fixtures/sandbox-repo');
const repos = fs
  .readdirSync(sandboxDir)
  .filter(f => fs.statSync(path.join(sandboxDir, f)).isDirectory() && f.startsWith('repo-'));

if (repos.length === 0) {
  console.log('No sandbox repos found');
  process.exit(1);
}

// Find repo with debug files
let repoPath = null;
let insertFiles = [];
let dbFiles = [];

for (const repo of repos.sort().reverse()) {
  const debugPath = path.join(sandboxDir, repo, '.debug');
  if (fs.existsSync(debugPath)) {
    const files = fs.readdirSync(debugPath);
    const inserts = files
      .filter(f => f.startsWith('symbol-inserts-'))
      .map(f => ({
        name: f,
        path: path.join(debugPath, f),
        mtime: fs.statSync(path.join(debugPath, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);
    const dbs = files
      .filter(f => f.startsWith('db-state-'))
      .map(f => ({
        name: f,
        path: path.join(debugPath, f),
        mtime: fs.statSync(path.join(debugPath, f)).mtime,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (inserts.length > 0 && dbs.length > 0) {
      repoPath = path.join(sandboxDir, repo);
      insertFiles = inserts;
      dbFiles = dbs;
      break;
    }
  }
}

if (insertFiles.length === 0 || dbFiles.length === 0) {
  console.log('No debug files found');
  process.exit(1);
}

// Find commit 0 data (first commit, should have math.ts)
const commit0InsertFile =
  insertFiles.find(f => {
    const data = JSON.parse(fs.readFileSync(f.path, 'utf8'));
    return data.attempts && data.attempts.some(a => a.path === 'src/ts/math.ts');
  }) || insertFiles[insertFiles.length - 1];

const commit0DbFile =
  dbFiles.find(f => {
    const data = JSON.parse(fs.readFileSync(f.path, 'utf8'));
    return (
      data.commit &&
      data.symbols &&
      data.symbols.some(s => s.path === 'src/ts/math.ts' || s.path.includes('math'))
    );
  }) || dbFiles[dbFiles.length - 1];

if (!commit0InsertFile || !commit0DbFile) {
  console.log('Could not find commit 0 files');
  process.exit(1);
}

const insertData = JSON.parse(fs.readFileSync(commit0InsertFile.path, 'utf8'));
const dbData = JSON.parse(fs.readFileSync(commit0DbFile.path, 'utf8'));

console.log('=== COMPARISON (COMMIT 0) ===\n');
console.log(`Insert file: ${commit0InsertFile.name}`);
console.log(`DB file: ${commit0DbFile.name}`);
console.log(
  `Insert attempts: ${insertData.totalAttempts} (${insertData.successful} successful, ${insertData.failed} failed)`
);
console.log(`Stored in DB: ${dbData.totalStored}`);
console.log(`Commit SHA: ${dbData.commit || insertData.attempts[0]?.sha || 'unknown'}\n`);

// Group by path
const insertByPath = {};
insertData.attempts.forEach(a => {
  if (!insertByPath[a.path]) insertByPath[a.path] = [];
  insertByPath[a.path].push(a);
});

const storedByPath = dbData.groupedByPath || {};

console.log('=== BY PATH ===');
Object.keys(insertByPath)
  .sort()
  .forEach(p => {
    const attempted = insertByPath[p].length;
    const stored = (storedByPath[p] || []).length;
    const status = attempted === stored ? '✓' : '✗';
    console.log(`${status} ${p}: ${attempted} attempted, ${stored} stored`);
    if (attempted !== stored) {
      console.log(`  MISSING: ${attempted - stored} symbols`);
      const attemptedDnas = new Set(insertByPath[p].map(a => a.dna_id));
      const storedDnas = new Set((storedByPath[p] || []).map(s => s.dna_id));
      const missing = [...attemptedDnas].filter(d => !storedDnas.has(d));
      console.log(`  Missing DNA IDs: ${missing.length}`);
      if (missing.length > 0) {
        const missingNames = insertByPath[p]
          .filter(a => missing.includes(a.dna_id))
          .map(a => a.name);
        console.log(`  Missing names: ${missingNames.join(', ')}`);
      }
    }
  });

console.log('\n=== CHECKING FOR DNA COLLISIONS ===');
const allDnaIds = new Map();
insertData.attempts.forEach(a => {
  const key = `${a.sha}|${a.dna_id}`;
  if (!allDnaIds.has(key)) {
    allDnaIds.set(key, []);
  }
  allDnaIds.get(key).push(a);
});

const collisions = Array.from(allDnaIds.entries()).filter(([_, entries]) => entries.length > 1);
if (collisions.length > 0) {
  console.log(`Found ${collisions.length} DNA collisions (same DNA in multiple files):`);
  collisions.slice(0, 5).forEach(([key, entries]) => {
    console.log(`  ${key}:`);
    entries.forEach(e => console.log(`    - ${e.path}: ${e.name}`));
  });
} else {
  console.log('No DNA collisions found');
}

console.log('\n=== CHECKING FOR PATH+DNA COLLISIONS ===');
const pathDnaMap = new Map();
insertData.attempts.forEach(a => {
  const key = `${a.sha}|${a.path}|${a.dna_id}`;
  if (!pathDnaMap.has(key)) {
    pathDnaMap.set(key, []);
  }
  pathDnaMap.get(key).push(a);
});

const pathCollisions = Array.from(pathDnaMap.entries()).filter(
  ([_, entries]) => entries.length > 1
);
if (pathCollisions.length > 0) {
  console.log(`Found ${pathCollisions.length} path+DNA collisions (same DNA twice in same file):`);
  pathCollisions.forEach(([key, entries]) => {
    console.log(`  ${key}:`);
    entries.forEach(e => console.log(`    - ${e.name}`));
  });
} else {
  console.log('No path+DNA collisions found');
}
