import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

// well-known files in server/well-known/ (deployed with server); fallback to docs/well-known/
const cwd = process.cwd();
const WELL_KNOWN_DIR = fs.existsSync(path.join(cwd, 'well-known'))
  ? path.join(cwd, 'well-known')
  : path.join(cwd, '..', 'docs', 'well-known');

export const wellKnownRouter = Router();

/**
 * GET /.well-known/apple-app-site-association
 * Serves the AASA file for iOS universal links.
 * Must be application/json, no .json extension in URL.
 */
wellKnownRouter.get('/apple-app-site-association', (_req, res) => {
  const filePath = path.join(WELL_KNOWN_DIR, 'apple-app-site-association');
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(content);
  } catch (err) {
    console.warn('[well-known] AASA file not found:', filePath);
    res.status(404).json({ error: 'Not found' });
  }
});

/**
 * GET /.well-known/assetlinks.json
 * Serves the asset links file for Android App Links.
 */
wellKnownRouter.get('/assetlinks.json', (_req, res) => {
  const filePath = path.join(WELL_KNOWN_DIR, 'assetlinks.json');
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'application/json');
    res.send(content);
  } catch (err) {
    console.warn('[well-known] assetlinks.json not found:', filePath);
    res.status(404).json({ error: 'Not found' });
  }
});
