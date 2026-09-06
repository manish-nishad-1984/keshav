import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Stays a string (not coerced to a number): IISNode assigns a named-pipe
  // path here, not a TCP port, and Node's server.listen() needs the raw
  // value either way — coercing a pipe path through Number() yields NaN.
  PORT: z.string().default('4000'),
  API_PREFIX: z.string().default('/api/v1'),

  DATABASE_URL: z.string(),

  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  JWT_REFRESH_TTL_LONG: z.string().default('30d'),
  JWT_ISSUER: z.string().default('ck-fast'),

  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  LOGIN_MAX_ATTEMPTS: z.coerce.number().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().default(15),
  BCRYPT_ROUNDS: z.coerce.number().default(12),

  SEED_ORG_CODE: z.string().default('CKFAST'),
  SEED_ADMIN_EMAIL: z.string().default('admin@ckfast.local'),
  SEED_ADMIN_PASSWORD: z.string().default('ChangeMe123!'),
  SEED_COMPANY_NAME: z.string().default('CK Fast'),
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
