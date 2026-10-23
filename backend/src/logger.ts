import type { FastifyServerOptions } from 'fastify'

export function getLoggerOptions(level: string): FastifyServerOptions['logger'] {
  return {
    level,
    base: { service: 'flowline-backend' },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password', 'req.body.confirmPassword', 'res.headers.set-cookie', 'password', '*.password', 'DATABASE_URL', 'connectionString'],
      censor: '[REDACTED]',
    },
  }
}
