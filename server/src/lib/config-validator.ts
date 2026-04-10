import { env } from './env.js';

type ServiceKey =
  | 'database'
  | 'jwt'
  | 'stripe'
  | 'cloudinary'
  | 'email'
  | 'googleOAuth'
  | 'googleMaps'
  | 'twilio'
  | 'redis'
  | 'sentry';

export type ServiceStatus = {
  key: ServiceKey;
  label: string;
  ok: boolean;
  required: boolean;
  help: string;
};

type ServiceDefinition = Omit<ServiceStatus, 'ok'> & { check: () => boolean };

const serviceDefinitions: ServiceDefinition[] = [
  {
    key: 'database',
    label: 'Database',
    required: true,
    help: 'Set DATABASE_URL to your PostgreSQL connection string.',
    check: () => !!env.DATABASE_URL,
  },
  {
    key: 'jwt',
    label: 'JWT secret',
    required: true,
    help: 'Set JWT_SECRET to a 32+ character random string.',
    check: () => !!env.JWT_SECRET,
  },
  {
    key: 'stripe',
    label: 'Stripe',
    required: true,
    help: 'Set STRIPE_SECRET_KEY (and webhook secret) so payments can run.',
    check: () => !!env.STRIPE_SECRET_KEY,
  },
  {
    key: 'cloudinary',
    label: 'Cloudinary',
    required: false,
    help: 'Set CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET to enable media uploads.',
    check: () =>
      !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  },
  {
    key: 'email',
    label: 'Email service',
    required: true,
    help: 'Set EMAIL_PROVIDER=sendgrid, SENDGRID_API_KEY, and EMAIL_FROM so transactional email works.',
    check: () =>
      env.EMAIL_PROVIDER === 'test' ||
      !!(env.SENDGRID_API_KEY && (env.EMAIL_FROM || env.FROM_EMAIL)),
  },
  {
    key: 'googleOAuth',
    label: 'Google OAuth',
    required: false,
    help: 'Set GOOGLE_OAUTH_CLIENT_IDS to enable Google sign-in.',
    check: () => !!env.GOOGLE_OAUTH_CLIENT_IDS,
  },
  {
    key: 'googleMaps',
    label: 'Google Maps',
    required: false,
    help: 'Set GOOGLE_MAPS_API_KEY to enable mapping features.',
    check: () => !!env.GOOGLE_MAPS_API_KEY,
  },
  {
    key: 'twilio',
    label: 'Twilio',
    required: false,
    help: 'Set TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_PHONE for SMS.',
    check: () => !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM_PHONE),
  },
  {
    key: 'redis',
    label: 'Redis / Queue backend',
    required: false,
    help: 'Set REDIS_URL to enable background jobs and rate limiting stores.',
    check: () => !!env.REDIS_URL,
  },
  {
    key: 'sentry',
    label: 'Sentry',
    required: false,
    help: 'Set SENTRY_DSN so errors get reported.',
    check: () => !!env.SENTRY_DSN,
  },
];

export function validateConfig() {
  const services: ServiceStatus[] = serviceDefinitions.map(definition => ({
    key: definition.key,
    label: definition.label,
    required: definition.required,
    help: definition.help,
    ok: definition.check(),
  }));
  const errors = services.filter(s => s.required && !s.ok).map(s => `${s.label}: ${s.help}`);
  const warnings = services.filter(s => !s.required && !s.ok).map(s => `${s.label}: ${s.help}`);
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    services,
  };
}
