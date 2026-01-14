import { Router } from 'express';
import { validateConfig } from '../lib/config-validator.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';

export const healthRouter = Router();

/**
 * Health check endpoint with integration status
 * GET /health
 */
healthRouter.get('/', (req, res) => {
  const configStatus = validateConfig();
  const integrations = Object.fromEntries(configStatus.services.map((service) => [service.key, service.ok])) as Record<
    string,
    boolean
  >;
  const allConfigured = configStatus.services.filter((service) => service.required).every((service) => service.ok);

  res.json({
    status: 'ok',
    version: 'v2024.12.17-sendgrid-fix',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    integrations,
    ready: allConfigured,
    warnings: configStatus.warnings,
    errors: configStatus.errors,
  });
});

/**
 * GET /health/ready - Kubernetes-style readiness probe
 * Returns 503 if database unreachable or critical config missing
 */
healthRouter.get('/ready', async (_req, res) => {
  const checks: Record<string, any> = {
    timestamp: new Date().toISOString(),
    database: { ok: false, latency_ms: null },
    config: { ok: false },
  };

  // Database connectivity check
  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latency_ms: Date.now() - start };
  } catch (err: any) {
    checks.database = { ok: false, error: err.message };
  }

  // Config validation
  const configStatus = validateConfig();
  checks.config = {
    ok: configStatus.valid,
    errors: configStatus.errors,
    warnings: configStatus.warnings,
  };

  const ready = checks.database.ok && checks.config.ok;
  res.status(ready ? 200 : 503).json({ ready, checks });
});

/**
 * GET /health/services - Detailed service status for debugging
 */
healthRouter.get('/services', (_req, res) => {
  const configStatus = validateConfig();
  res.json({
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    services: configStatus.services,
    warnings: configStatus.warnings,
    errors: configStatus.errors,
  });
});
