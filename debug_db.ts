
import { getDatabaseManager, ensureDatabaseInitialized } from './src/storage/database';

async function debugDb() {
    await ensureDatabaseInitialized();
    const dbManager = getDatabaseManager();
    const db = dbManager.getDatabase();

    const shas = ['3a5fa79f', '7bbd0eb5', '66b4ad72']; // Partial SHAs from log

    console.log('--- Debugging DB Content ---');

    // Check commits_analysis
    const analysis = db.prepare(`SELECT sha, status FROM commits_analysis`).all();
    console.log(`Total commits in analysis: ${analysis.length}`);
    analysis.forEach((c: any) => console.log(` - ${c.sha}: ${c.status}`));

    // Check symbols table columns
    const columns = db.prepare(`PRAGMA table_info(symbols)`).all();
    console.log('Symbols table columns:', columns.map((c: any) => c.name).join(', '));

    // Check symbol_history
    const historyCount = db.prepare('SELECT COUNT(*) as count FROM symbol_history').get() as any;
    console.log(`Total symbol_history rows: ${historyCount.count}`);

    // Check commits_metadata
    const commits = db.prepare(`SELECT sha, date FROM commits_metadata`).all();
    console.log(`Total commits in metadata: ${commits.length}`);
    commits.forEach((c: any) => console.log(` - ${c.sha} (${c.date})`));

    // Check symbols
    const symbolCount = db.prepare('SELECT COUNT(*) as count FROM symbols').get() as any;
    console.log(`Total symbols in DB: ${symbolCount.count}`);

    for (const sha of shas) {
        // We need to match partial SHAs to full SHAs in DB
        const fullSha = commits.find((c: any) => c.sha.startsWith(sha))?.sha;
        if (!fullSha) {
            console.log(`SHA ${sha} not found in DB`);
            continue;
        }

        console.log(`\nChecking SHA: ${fullSha}`);
        const symbols = db.prepare('SELECT * FROM symbols WHERE sha = ?').all(fullSha);
        console.log(` - Symbols count: ${symbols.length}`);
        if (symbols.length > 0) {
            console.log(' - Sample symbol:', symbols[0]);
        }

        const renames = db.prepare('SELECT * FROM renames WHERE sha = ?').all(fullSha);
        console.log(` - Renames count: ${renames.length}`);
    }
}

debugDb().catch(console.error);
