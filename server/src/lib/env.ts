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
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters. Generate with `openssl rand -base64 32`'),
  ALLOWED_ORIGINS: z.string().optional(),
  RATE_LIMIT_DISABLE: z.string().optional(),
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
  EMAIL_PROVIDER: z.enum(['sendgrid', 'test']).optional().default('sendgrid'),
  EMAIL_FROM: z.string().optional().transform(toOptional),
  EMAIL_TIMEOUT_MS: z.string().optional(),
  EMAIL_RETRY_ATTEMPTS: z.string().optional(),
  EMAIL_RETRY_DELAY_MS: z.string().optional(),
  EMAIL_ENABLE_QUEUE: z.string().optional(),
  EMAIL_ENABLE_LOGGING: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional().transform(toOptional),
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
  EMAIL_SANDBOX_MODE: z.string().optional().transform(toOptional),
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
