import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function resolveWellKnownDir(baseCwd = process.cwd()): string | null {
  const candidates = [
    path.join(baseCwd, 'well-known'),
    path.join(baseCwd, 'server', 'well-known'),
    path.join(baseCwd, 'docs', 'well-known'),
    path.resolve(moduleDir, '..', '..', 'well-known'),
    path.resolve(moduleDir, '..', '..', '..', 'docs', 'well-known'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'apple-app-site-association'))) {
      return candidate;
    }
  }

  return null;
}

function readWellKnownFile(filename: 'apple-app-site-association' | 'assetlinks.json'): string | null {
  const dir = resolveWellKnownDir();
  if (!dir) return null;

  const filePath = path.join(dir, filename);
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export const wellKnownRouter = Router();

/**
 * GET /.well-known/apple-app-site-association
 * Serves the AASA file for iOS universal links.
 * Must be application/json, no .json extension in URL.
 */
wellKnownRouter.get('/apple-app-site-association', (_req, res) => {
  const content = readWellKnownFile('apple-app-site-association');
  if (content) {
    res.setHeader('Content-Type', 'application/json');
    res.send(content);
    return;
  }

  console.warn('[well-known] AASA file not found in any known deployment path');
  res.status(404).json({ error: 'Not found' });
});

/**
 * GET /.well-known/assetlinks.json
 * Serves the asset links file for Android App Links.
 */
wellKnownRouter.get('/assetlinks.json', (_req, res) => {
  const content = readWellKnownFile('assetlinks.json');
  if (content) {
    res.setHeader('Content-Type', 'application/json');
    res.send(content);
    return;
  }

  console.warn('[well-known] assetlinks.json not found in any known deployment path');
  res.status(404).json({ error: 'Not found' });
});
