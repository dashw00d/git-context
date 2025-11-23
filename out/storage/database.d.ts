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
//# sourceMappingURL=database.d.ts.map