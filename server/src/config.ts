import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().min(1).default('localhost'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  CLIENT_ORIGIN: z.url().refine((value) => {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
  }, 'Expected an HTTP origin without a path'),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb:\/\//, 'Expected a local MongoDB URI'),
  SESSION_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(2592000)
    .default(604800),
  SESSION_IDLE_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(604800)
    .default(86400),
  AUTH_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(100).default(10),
  AUTH_WINDOW_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  SMTP_HOST: z.string().max(253).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(465),
  SMTP_USER: z.string().max(254).optional(),
  SMTP_PASS: z.string().max(4096).optional(),
  MAIL_FROM: z.union([z.email().max(254), z.literal('')]).optional(),
  RESET_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .min(300)
    .max(3600)
    .default(900),
  GOOGLE_CLIENT_ID: z.string().max(512).optional(),
  GOOGLE_CLIENT_SECRET: z.string().max(4096).optional(),
  GOOGLE_PKCE_KEY: z.string().optional(),
  AI_PROVIDER: z.enum(['gemini', 'fulldichvu']).default('gemini'),
  FULLDICHVU_API_KEY: z.string().trim().max(4096).optional(),
  FULLDICHVU_MODEL: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/)
    .max(200)
    .default('fulldichvu/haiku-4.5'),
  GEMINI_API_KEY: z.string().max(4096).optional(),
  GEOAPIFY_API_KEY: z.string().trim().max(4096).optional(),
  GEMINI_MODEL: z
    .string()
    .regex(/^gemini-[a-z0-9.-]+$/)
    .default('gemini-3.5-flash-lite'),
  AI_DAILY_USER_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
  AI_DAILY_GLOBAL_LIMIT: z.coerce.number().int().min(1).max(1000).default(20),
  GOOGLE_REDIRECT_URI: z
    .url()
    .default('http://localhost:3000/api/v1/auth/google/callback'),
});

export function parseConfig(env: NodeJS.ProcessEnv) {
  const result = schema.safeParse(env);
  if (!result.success) {
    // Report field names only: validation input may contain credentials.
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  if (
    result.data.NODE_ENV === 'production' &&
    !result.data.CLIENT_ORIGIN.startsWith('https://')
  )
    throw new Error(
      'Invalid environment: CLIENT_ORIGIN requires HTTPS in production',
    );
  return result.data;
}
export type Config = ReturnType<typeof parseConfig>;
