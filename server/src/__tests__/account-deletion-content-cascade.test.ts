/**
 * Notes 7/15 #3 — deleting an account must remove the user's social content,
 * not just their profile PII. Comments are onDelete:SetNull so they would
 * otherwise linger orphaned; posts are soft-deleted so they leave every feed
 * immediately.
 */
import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(process.cwd(), 'src', 'lib', 'accountDeletion.ts'), 'utf8');

describe('softDeleteUserAccount content cascade', () => {
  it('deletes the user comments (SetNull would orphan them)', () => {
    expect(src).toMatch(/tx\.comment\.deleteMany\(\{ where: \{ author_id: userId \} \}\)/);
  });
  it('purges poll and game votes', () => {
    expect(src).toMatch(/tx\.pollVote\.deleteMany/);
    expect(src).toMatch(/tx\.gameVote\.deleteMany/);
  });
  it('soft-deletes the user posts so they drop out of feeds immediately', () => {
    expect(src).toMatch(/tx\.post\.updateMany\(/);
    expect(src).toMatch(/author_id: userId, deleted_at: null/);
    expect(src).toMatch(/data: \{ deleted_at: deletedAt \}/);
  });
  it('runs the cascade inside the deletion transaction', () => {
    const txStart = src.indexOf('prisma.$transaction');
    const commentDelete = src.indexOf('tx.comment.deleteMany');
    const userUpdate = src.indexOf('tx.user.update');
    expect(txStart).toBeGreaterThan(-1);
    expect(commentDelete).toBeGreaterThan(txStart);
    expect(commentDelete).toBeLessThan(userUpdate);
  });
});

describe('RSVP email date rendering', () => {
  const email = readFileSync(join(process.cwd(), 'src', 'lib', 'email.ts'), 'utf8');
  it('passes a timezone-aware event_date_display via formatEventTime', () => {
    expect(email).toMatch(
      /event_date_display: formatEventTime\(params\.eventDate, params\.timezone\)/
    );
  });
});
