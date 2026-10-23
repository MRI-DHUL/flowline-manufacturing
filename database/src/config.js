import 'dotenv/config';
export function getDatabaseUrl() {
    const value = process.env.DATABASE_URL?.trim();
    if (!value) {
        throw new Error('DATABASE_URL is required. Copy .env.example to .env and add the pooled Neon connection string.');
    }
    return value;
}
