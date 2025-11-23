export declare class DatabaseManager {
    private db;
    private dbPath;
    constructor();
    getDatabase(): any;
    initialize(): Promise<void>;
    private initializeSchema;
    save(): void;
    close(): void;
}
export declare function getDatabaseManager(): DatabaseManager;
export declare function ensureDatabaseInitialized(): Promise<void>;
export declare function getDatabase(): any;
/**
 * Close database connection and cleanup resources.
 * Should be called on extension deactivation.
 */
export declare function closeDatabase(): void;
//# sourceMappingURL=database.d.ts.map