/**
 * Centralized configuration module
 * Consolidates all environment variable access with validation and defaults
 * Prevents repeated process.env reads and ensures consistent config across the app
 */

import './load-env.js'; // Ensure env vars are loaded first

// Validate required env vars and provide sensible defaults
function validateRequired(envVar: string, fallback?: string): string {
  const value = process.env[envVar] || fallback;
  if (!value) {
    console.warn(`[config] Environment variable ${envVar} is not set`);
  }
  return value || '';
}

function validateOptional(envVar: string, fallback?: string): string | undefined {
  return process.env[envVar] || fallback;
}

// Stripe Configuration
export const stripeConfig = {
  secretKey: validateRequired('STRIPE_SECRET_KEY'),
  publishableKey: validateRequired('STRIPE_PUBLISHABLE_KEY'),
  webhookSecret: validateRequired('STRIPE_WEBHOOK_SECRET'),
  
  // Plan price IDs
  prices: {
    veteran: validateOptional('STRIPE_PRICE_VETERAN'),
    legend: validateOptional('STRIPE_PRICE_LEGEND'),
    // Ad hosting prices
    adWeekday: validateOptional(
      'STRIPE_PRICE_AD_WEEKDAY',
      'price_1SNFWzGJt8CsPE1EIikRsZif'
    ),
    adWeekend: validateOptional(
      'STRIPE_PRICE_AD_WEEKEND',
      'price_1SNFXxGJt8CsPE1ECbmJRQDa'
    ),
  },
  
  apiVersion: '2024-06-20' as const,
  
  isConfigured(): boolean {
    return !!this.secretKey && !!this.webhookSecret;
  },
};

// Apple Authentication Configuration
export const appleConfig = {
  teamId: validateOptional('APPLE_TEAM_ID'),
  keyId: validateOptional('APPLE_KEY_ID'),
  bundleId: validateOptional('APPLE_BUNDLE_ID', 'com.varsityhub.mobile'),
  isConfigured(): boolean {
    return !!this.teamId && !!this.keyId;
  },
};

// Google/API Configuration
export const googleConfig = {
  mapsApiKey: validateOptional('GOOGLE_MAPS_API_KEY'),
  geocodingApiKey: validateOptional('GOOGLE_GEOCODING_API_KEY'),
};

// SendGrid Configuration
export const sendgridConfig = {
  apiKey: validateOptional('SENDGRID_API_KEY'),
  fromEmail: validateOptional('SENDGRID_FROM_EMAIL', 'noreply@varsityhub.app'),
  
  // Email template IDs
  templates: {
    paymentFailed: validateOptional('SENDGRID_PAYMENT_FAILED_TEMPLATE_ID'),
    paymentReceipt: validateOptional('SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID'),
    subscriptionExpiring: validateOptional('SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID'),
    subscriptionCanceled: validateOptional('SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID'),
  },
  
  isConfigured(): boolean {
    return !!this.apiKey;
  },
};

// App Configuration
export const appConfig = {
  baseUrl: validateOptional('APP_BASE_URL', process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000'),
  scheme: validateOptional('APP_SCHEME', 'varsityhubmobile'),
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  
  isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  },
  
  isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
};

// Cloudinary Configuration
export const cloudinaryConfig = {
  cloudName: validateOptional('CLOUDINARY_CLOUD_NAME'),
  apiKey: validateOptional('CLOUDINARY_API_KEY'),
  apiSecret: validateOptional('CLOUDINARY_API_SECRET'),
  uploadPreset: validateOptional('CLOUDINARY_UPLOAD_PRESET'),
  
  isConfigured(): boolean {
    return !!this.cloudName && !!this.apiKey;
  },
};

// Twilio Configuration
export const twilioConfig = {
  accountSid: validateOptional('TWILIO_ACCOUNT_SID'),
  authToken: validateOptional('TWILIO_AUTH_TOKEN'),
  phoneNumber: validateOptional('TWILIO_PHONE_NUMBER'),
  
  isConfigured(): boolean {
    return !!this.accountSid && !!this.authToken;
  },
};

// Sentry Configuration
export const sentryConfig = {
  dsn: validateOptional('SENTRY_DSN'),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
  
  isConfigured(): boolean {
    return !!this.dsn;
  },
};

// Database Configuration
export const databaseConfig = {
  databaseUrl: validateRequired('DATABASE_URL'),
};

/**
 * Validate critical configuration at startup
 * Called from server index.ts during initialization
 */
export function validateConfigAtStartup(): void {
  const issues: string[] = [];
  
  if (!stripeConfig.isConfigured()) {
    issues.push('Stripe configuration incomplete (missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET)');
  }
  
  if (!databaseConfig.databaseUrl) {
    issues.push('DATABASE_URL not set');
  }
  
  if (appConfig.isProduction()) {
    if (!sendgridConfig.isConfigured()) {
      issues.push('SendGrid not configured for production (missing SENDGRID_API_KEY)');
    }
    if (!stripeConfig.prices.veteran || !stripeConfig.prices.legend) {
      issues.push('Stripe price IDs not fully configured for production');
    }
  }
  
  if (issues.length > 0) {
    console.error('[config] Startup validation issues:');
    issues.forEach(issue => console.error(`  - ${issue}`));
    if (appConfig.isProduction()) {
      throw new Error('Critical configuration missing for production');
    }
  }
}

export default {
  stripe: stripeConfig,
  apple: appleConfig,
  google: googleConfig,
  sendgrid: sendgridConfig,
  app: appConfig,
  cloudinary: cloudinaryConfig,
  twilio: twilioConfig,
  sentry: sentryConfig,
  database: databaseConfig,
  validateAtStartup: validateConfigAtStartup,
};
