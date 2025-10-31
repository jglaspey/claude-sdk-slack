export declare const config: {
    slack: {
        botToken: string;
        signingSecret: string;
        appToken: string;
    };
    claude: {
        apiKey: string;
    };
    app: {
        port: number;
        nodeEnv: string;
        logLevel: string;
    };
    session: {
        cleanupIntervalHours: number;
        ttlHours: number;
        dataDir: string;
        dbPath: string;
    };
};
export declare function validateConfig(): void;
//# sourceMappingURL=config.d.ts.map