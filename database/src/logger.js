import pino from 'pino';
export const logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
        paths: ['DATABASE_URL', 'password', '*.password', 'connectionString'],
        censor: '[REDACTED]',
    },
    base: { service: 'flowline-database' },
});
