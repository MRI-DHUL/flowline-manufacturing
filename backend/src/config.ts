import 'dotenv/config'
import { z } from 'zod'

const developmentJwtSecret = 'flowline-development-jwt-secret-change-me-32chars'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  FRONTEND_ORIGIN: z.url().default('http://127.0.0.1:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32).default(developmentJwtSecret),
  JWT_SECRETS: z.string().default(''),
  SMTP_ENABLED: z.coerce.boolean().default(false),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_FROM: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
}).superRefine((config, context) => {
  if (config.NODE_ENV === 'production' && config.JWT_SECRET === developmentJwtSecret && !config.JWT_SECRETS.trim()) {
    context.addIssue({ code: 'custom', path: ['JWT_SECRET'], message: 'JWT_SECRET must be replaced in production.' })
  }
})

export type AppConfig = z.infer<typeof environmentSchema>

export function getConfig(): AppConfig {
  const result = environmentSchema.safeParse(process.env)
  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Invalid backend environment configuration: ${fields}`)
  }
  return result.data
}
