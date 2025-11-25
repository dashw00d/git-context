const path = require('path');
const fs = require('fs');

async function checkSymbols() {
    try {
        const gitRoot = process.cwd();
        const dbPath = path.join(gitRoot, '.git', 'commit-tracker', 'commit_tracker.db');
        console.log('DB Path:', dbPath);
        
        if (!fs.existsSync(dbPath)) {
            console.log('Database file does not exist!');
            return;
        }

        // We need to find where better-sqlite3 is installed. 
        // Since this is an extension, it might be in node_modules.
        let Database;
        try {
            Database = require('better-sqlite3');
        } catch (e) {
            console.log('better-sqlite3 not found in current path, trying relative...');
            try {
                Database = require('./node_modules/better-sqlite3');
            } catch (e2) {
                console.error('Could not load better-sqlite3. Please ensure dependencies are installed.');
                return;
            }
        }
        
        const db = new Database(dbPath);
        
        const count = db.prepare('SELECT COUNT(*) as count FROM symbols').get();
        console.log('Symbol count:', count.count);
        
        if (count.count > 0) {
            const rows = db.prepare('SELECT name, kind, path FROM symbols LIMIT 5').all();
            console.log('Sample symbols:', rows);
        } else {
            console.log('No symbols found in database.');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

checkSymbols();
