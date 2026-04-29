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
  STRIPE_PUBLISHABLE_KEY: z.string().optional().transform(toOptional),
  EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().transform(toOptional),
  STRIPE_WEBHOOK_SECRET: z.string().optional().transform(toOptional),
  STRIPE_PRICE_VETERAN: z.string().optional().transform(toOptional),
  STRIPE_PRICE_LEGEND: z.string().optional().transform(toOptional),
  STRIPE_PRICE_AD_WEEKDAY: z.string().optional().transform(toOptional),
  STRIPE_PRICE_AD_WEEKEND: z.string().optional().transform(toOptional),
  CLOUDINARY_CLOUD_NAME: z.string().optional().transform(toOptional),
  CLOUDINARY_API_KEY: z.string().optional().transform(toOptional),
  CLOUDINARY_API_SECRET: z.string().optional().transform(toOptional),
  AD_IMAGE_MODERATION_ENABLED: z.string().optional().transform(toOptional),
  AD_IMAGE_MODERATION_MIN_CONFIDENCE: z.string().optional(),
  REKOGNITION_REGION: z.string().optional().transform(toOptional),
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
  ADMIN_NOTIFICATION_EMAILS: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional().transform(toOptional),
  TWILIO_AUTH_TOKEN: z.string().optional().transform(toOptional),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional().transform(toOptional),
  TWILIO_FROM_PHONE: z.string().optional().transform(toOptional),
  REDIS_URL: z.string().optional().transform(toOptional),
  SENTRY_DSN: z.string().optional().transform(toOptional),
  SENTRY_ENVIRONMENT: z.string().optional().transform(toOptional),
  SENDGRID_API_KEY: z.string().optional().transform(toOptional),
  DEMO_ACCOUNT_PASSWORD: z.string().optional().transform(toOptional),
  UPLOADS_PUBLIC: z.string().optional(),
  /** iOS in-app purchase receipt verification (App Store Connect → App → App-Specific Shared Secret) */
  APPLE_IAP_SHARED_SECRET: z.string().optional().transform(toOptional),
  /** iOS bundle identifier for Apple Sign-In and payment verification */
  APPLE_BUNDLE_ID: z.string().optional().transform(toOptional),
  /** Apple Sign-In Services ID (client ID) */
  APPLE_CLIENT_ID: z.string().optional().transform(toOptional),
  /** Google Play package names for Android payment verification (comma-separated) */
  GOOGLE_PLAY_PACKAGE_NAMES: z.string().optional().transform(toOptional),
  /** Google Play service account email for server-side receipt verification */
  GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL: z.string().optional().transform(toOptional),
  /** Google Play service account private key (PEM format) */
  GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional().transform(toOptional),
  /** Strict Google Play receipt verification (set to '1' to reject unverified) */
  GOOGLE_PLAY_STRICT_VERIFY: z.string().optional(),
  /** Email provider: sendgrid or test */
  EMAIL_PROVIDER: z.string().optional().transform(toOptional),
  /** Sender email (alternative to FROM_EMAIL) */
  EMAIL_FROM: z.string().optional().transform(toOptional),
  /** API base URL for email links */
  API_BASE_URL: z.string().optional().transform(toOptional),
  /** Health check endpoint secret */
  HEALTH_CHECK_SECRET: z.string().optional().transform(toOptional),
  /** Debug logging toggle */
  ENABLE_SERVER_DEBUG_LOGS: z.string().optional(),
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

// Production startup warnings for critical optional vars
if (isProd) {
  const warnings: string[] = [];
  if (!env.STRIPE_SECRET_KEY) warnings.push('STRIPE_SECRET_KEY (payments will fail)');
  // Webhook secret is critical — without it every Stripe event returns 503 and ads/subscriptions never activate
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      'FATAL: STRIPE_WEBHOOK_SECRET is not set. All Stripe webhooks will return 503 and payments will never complete. Set this in Railway env vars immediately.'
    );
  }
  if (!env.STRIPE_PRICE_VETERAN) warnings.push('STRIPE_PRICE_VETERAN (subscription pricing)');
  if (!env.STRIPE_PRICE_LEGEND) warnings.push('STRIPE_PRICE_LEGEND (subscription pricing)');
  // v1.0.2 audit: Cloudinary misconfig silently falls back to ephemeral Railway disk,
  // which wipes on deploy. Hard-throw in production so uploads can't silently disappear.
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new Error(
      'FATAL: Cloudinary env vars (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) are not all set. Without them uploads fall back to ephemeral Railway disk and are lost on every deploy. Set these in Railway env vars immediately.'
    );
  }
  if (env.AD_IMAGE_MODERATION_ENABLED && !env.REKOGNITION_REGION && !process.env.AWS_REGION) {
    warnings.push(
      'REKOGNITION_REGION or AWS_REGION (required when AD_IMAGE_MODERATION_ENABLED is on)'
    );
  }
  // v1.0.2 audit: geocoding silently returns null when API key missing → map/ad targeting broken.
  if (!env.GOOGLE_MAPS_API_KEY)
    warnings.push('GOOGLE_MAPS_API_KEY (maps, geocoding, event radius, ad targeting all disabled)');
  if (!env.SENDGRID_API_KEY) {
    throw new Error(
      'FATAL: SENDGRID_API_KEY is not set. Outbound email would silently fail in production. Set this in Railway env vars immediately.'
    );
  }
  if (env.APPLE_IAP_SHARED_SECRET && !env.APPLE_BUNDLE_ID) {
    throw new Error(
      'FATAL: APPLE_BUNDLE_ID is not set. Apple IAP signed-transaction verification will fail in production. Set this to the iOS bundle identifier immediately.'
    );
  }
  if (!env.APPLE_BUNDLE_ID) warnings.push('APPLE_BUNDLE_ID (Apple Sign-In/IAP)');
  if (!env.APPLE_CLIENT_ID) warnings.push('APPLE_CLIENT_ID (Apple Sign-In)');
  if (!env.REDIS_URL)
    warnings.push('REDIS_URL (email queue will not function — queued emails silently dropped)');
  if (!env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY)
    warnings.push(
      'GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL/KEY (Android IAP verification will return 503)'
    );
  if (warnings.length > 0) {
    console.warn(
      `⚠️  Missing production environment variables:\n${warnings.map(w => `  - ${w}`).join('\n')}`
    );
  }
}
