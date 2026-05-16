import 'dotenv/config';
import { z } from 'zod';

const booleanish = z
  .union([z.string(), z.boolean()])
  .transform((v) => {
    if (typeof v === 'boolean') return v;
    return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
  });

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  USE_MOCK_PROVIDER: booleanish.default(true),
  API_FOOTBALL_KEY: z.string().optional(),
  API_FOOTBALL_BASE_URL: z
    .string()
    .url()
    .default('https://v3.football.api-sports.io'),
  API_FOOTBALL_BOOKMAKER_ID: z.coerce.number().int().positive().default(6),

  ORACLE_INTERNAL_API_URL: z.string().url().default('http://localhost:3000'),
  ORACLE_INTERNAL_API_KEY: z.string().default('change-me'),

  ORACLE_PORT: z.coerce.number().int().positive().default(3002),
});

const refined = baseSchema.superRefine((cfg, ctx) => {
  if (!cfg.USE_MOCK_PROVIDER && !cfg.API_FOOTBALL_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['API_FOOTBALL_KEY'],
      message:
        'API_FOOTBALL_KEY is required when USE_MOCK_PROVIDER is false',
    });
  }
});

export type OracleConfig = z.infer<typeof baseSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OracleConfig {
  const parsed = refined.safeParse(env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid oracle configuration:\n${formatted}`);
  }
  return parsed.data;
}

export const config: OracleConfig = loadConfig();
