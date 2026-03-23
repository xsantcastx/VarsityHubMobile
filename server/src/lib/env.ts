import './load-env.js';
import { z } from 'zod';

const toOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().optional(),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_BACKUP_URL: z.string().optional().transform(toOptional),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters. Generate with `openssl rand -base64 32`'),
  ALLOWED_ORIGINS: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional().transform(toOptional),
  STRIPE_WEBHOOK_SECRET: z.string().optional().transform(toOptional),
  STRIPE_PRICE_VETERAN: z.string().optional().transform(toOptional),
  STRIPE_PRICE_LEGEND: z.string().optional().transform(toOptional),
  STRIPE_PRICE_AD_WEEKDAY: z.string().optional().transform(toOptional),
  STRIPE_PRICE_AD_WEEKEND: z.string().optional().transform(toOptional),
  CLOUDINARY_CLOUD_NAME: z.string().optional().transform(toOptional),
  CLOUDINARY_API_KEY: z.string().optional().transform(toOptional),
  CLOUDINARY_API_SECRET: z.string().optional().transform(toOptional),
  GOOGLE_OAUTH_CLIENT_IDS: z.string().optional().transform(toOptional),
  GOOGLE_MAPS_API_KEY: z.string().optional().transform(toOptional),
  SMTP_HOST: z.string().optional().transform(toOptional),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional().transform(toOptional),
  SMTP_PASS: z.string().optional().transform(toOptional),
  FROM_EMAIL: z.string().optional().transform(toOptional),
  CUSTOMER_SERVICE_EMAIL: z.string().optional().transform(toOptional),
  WEB_URL: z.string().optional().transform(toOptional),
  APP_BASE_URL: z.string().optional().transform(toOptional),
  EXPO_PUBLIC_API_URL: z.string().optional().transform(toOptional),
  ADMIN_EMAILS: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional().transform(toOptional),
  TWILIO_AUTH_TOKEN: z.string().optional().transform(toOptional),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional().transform(toOptional),
  TWILIO_FROM_PHONE: z.string().optional().transform(toOptional),
  REDIS_URL: z.string().optional().transform(toOptional),
  SENTRY_DSN: z.string().optional().transform(toOptional),
  UPLOADS_PUBLIC: z.string().optional(),
  /** iOS in-app purchase receipt verification (App Store Connect → App → App-Specific Shared Secret) */
  APPLE_IAP_SHARED_SECRET: z.string().optional().transform(toOptional),
  /** Set to '1' to return verification/reset codes in non-production API responses (dev/test only) */
  ENABLE_DEV_CODES: z.string().optional(),
  /** Set to 'true' to accept Apple simulator tokens (sim- prefix) — must NOT be set in production */
  ALLOW_APPLE_SIM_TOKENS: z.string().optional(),
  /** Set to '1' to disable rate limiting — dev/test only */
  DISABLE_RATE_LIMITING: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
