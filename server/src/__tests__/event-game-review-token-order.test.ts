import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const eventsSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'events.ts'), 'utf8');
const gamesSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'games.ts'), 'utf8');

describe('event/game review token order', () => {
  it('consumes event email-review tokens only after the approval service returns', () => {
    const start = eventsSrc.indexOf('async function handleEventTokenReview');
    const end = eventsSrc.indexOf('// One-time startup backfill:', start);
    const slice = eventsSrc.slice(start, end);
    expect(slice.indexOf('const result =')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result =')
    );
  });

  it('consumes game email-review tokens only after the approval service returns', () => {
    const start = gamesSrc.indexOf('async function handleGameTokenReview');
    const end = gamesSrc.indexOf('// One-time startup backfill:', start);
    const slice = gamesSrc.slice(start, end);
    expect(slice.indexOf('const result = await applyGameApprovalDecision')).toBeGreaterThan(0);
    expect(slice.indexOf('const consumeResult = await consumeReviewToken')).toBeGreaterThan(
      slice.indexOf('const result = await applyGameApprovalDecision')
    );
  });

  it('shows already-final pages before trying to consume a token', () => {
    expect(eventsSrc).toMatch(/if \(event\.approval_status === 'approved'\)/);
    expect(gamesSrc).toMatch(/if \(game\.approval_status === 'approved'\)/);
  });

  it('maps post-load race losses back to final-state pages instead of generic errors', () => {
    expect(eventsSrc).toContain('function renderEventFinalStatePage(');
    expect(eventsSrc).toContain(
      'const finalStatePage = latest ? renderEventFinalStatePage(latest, action) : null;'
    );
    expect(gamesSrc).toContain('function renderGameFinalStatePage(');
    expect(gamesSrc).toContain(
      'const finalStatePage = latest ? renderGameFinalStatePage(latest, action) : null;'
    );
  });
});
