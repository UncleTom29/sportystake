import 'dotenv/config';
import { z } from 'zod';

const csvStrings = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => {
    if (Array.isArray(v)) return v;
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  });

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  TRACKED_SPORTS: csvStrings.default(
    'football,basketball,tennis,baseball,american-football,ice-hockey,mixed-martial-arts,boxing,volleyball,table-tennis,handball,darts,snooker,rugby,cricket',
  ),
  TRACKED_LEAGUE_SLUGS: csvStrings.default(
    'england-premier-league,spain-la-liga,italy-serie-a,germany-bundesliga,france-ligue-1,europe-champions-league',
  ),
  TRACKED_SEASON: z.coerce.number().int().positive().default(2025),

  ORACLE_INTERNAL_API_URL: z.string().url().default('http://localhost:3000'),
  ORACLE_INTERNAL_API_KEY: z.string().default('change-me'),

  ORACLE_PORT: z.coerce.number().int().positive().default(3002),
});

export type OracleConfig = z.infer<typeof baseSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OracleConfig {
  const parsed = baseSchema.safeParse(env);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid oracle configuration:\n${formatted}`);
  }
  return parsed.data;
}

export const config: OracleConfig = loadConfig();
