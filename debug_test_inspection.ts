import { DatabaseManager } from './src/storage/database';
import * as path from 'path';
import * as fs from 'fs';

// Debug script to inspect test database contents
async function inspectTestDatabase() {
  const testDbPath = path.join(__dirname, 'tests/integration/sandbox-test.db');

  if (!fs.existsSync(testDbPath)) {
    console.log('Test database not found at:', testDbPath);
    return;
  }

  const dbManager = new DatabaseManager(testDbPath);
  await dbManager.initialize();
  const db = dbManager.getDatabase();

  console.log('=== Database Inspection ===');

  // Check symbols table
  console.log('\n--- Symbols Table ---');
  const symbols = db.prepare('SELECT sha, path, symbol_id, dna_id, name, kind, change_type FROM symbols LIMIT 20').all();
  console.log(`Total symbols: ${symbols.length}`);
  symbols.forEach(s => {
    console.log(`  ${s.sha?.substring(0,8)} | ${s.path} | ${s.symbol_id?.substring(0,16)}... | ${s.dna_id?.substring(0,16)}... | ${s.name} | ${s.kind} | ${s.change_type}`);
  });

  // Check edges table
  console.log('\n--- Edges Table ---');
  const edges = db.prepare('SELECT sha, from_symbol_id, to_symbol_id, change_type FROM edges LIMIT 20').all();
  console.log(`Total edges: ${edges.length}`);
  edges.forEach(e => {
    console.log(`  ${e.sha?.substring(0,8)} | ${e.from_symbol_id?.substring(0,16)}... | ${e.to_symbol_id?.substring(0,16)}... | ${e.change_type}`);
  });

  // Check commits_analysis table
  console.log('\n--- Commits Analysis Table ---');
  const commits = db.prepare('SELECT sha, status FROM commits_analysis LIMIT 20').all();
  console.log(`Total analyzed commits: ${commits.length}`);
  commits.forEach(c => {
    console.log(`  ${c.sha?.substring(0,8)} | ${c.status}`);
  });

  // Check specific queries from failing tests
  console.log('\n--- Specific Test Queries ---');

  // Query for math.ts symbols (should mark symbols as stale test)
  const mathSymbols = db.prepare('SELECT * FROM symbols WHERE path = ? AND sha = ?').all(['src/ts/math.ts', 'HEAD']);
  console.log(`Math.ts symbols with HEAD SHA: ${mathSymbols.length}`);

  const mathSymbolsAnySha = db.prepare('SELECT sha, path, symbol_id, dna_id, name FROM symbols WHERE path = ?').all(['src/ts/math.ts']);
  console.log(`Math.ts symbols (any SHA): ${mathSymbolsAnySha.length}`);
  mathSymbolsAnySha.forEach(s => {
    console.log(`  ${s.sha?.substring(0,8)} | ${s.path} | ${s.name} | ${s.dna_id?.substring(0,16)}...`);
  });

  // Check edges for Calculator.ts
  const calcEdges = db.prepare('SELECT e.*, s.path as from_path FROM edges e JOIN symbols s ON e.sha = s.sha AND e.from_symbol_id = s.dna_id WHERE s.path = ?').all(['src/ts/Calculator.ts']);
  console.log(`Calculator.ts edges: ${calcEdges.length}`);
  calcEdges.forEach(e => {
    console.log(`  ${e.sha?.substring(0,8)} | ${e.from_path} -> ${e.to_symbol_id?.substring(0,16)}...`);
  });

  dbManager.close();
}

inspectTestDatabase().catch(console.error);
