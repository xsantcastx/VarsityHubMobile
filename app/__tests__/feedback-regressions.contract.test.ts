import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const feedSource = readFileSync(join(process.cwd(), 'app', 'feed.tsx'), 'utf8');
const notificationsSource = readFileSync(
  join(process.cwd(), 'app', '(tabs)', 'notifications', 'index.tsx'),
  'utf8'
);

describe('Feedback regression contracts', () => {
  it('does not keep Fanatics Fest on a dedicated pinned feed rail', () => {
    expect(feedSource).not.toContain("case 'fest_header'");
    expect(feedSource).not.toContain("case 'fest_game'");
    expect(feedSource).not.toContain('isFanaticsFestGame');
    expect(feedSource).not.toContain('FEST_RECAP_');
  });

  it('treats opening notifications as the seen action', () => {
    expect(notificationsSource).toContain('Notification.markAllRead().catch');
    expect(notificationsSource).toContain('void clearNotificationBadge();');
    expect(notificationsSource).toContain('if (!isFocusedRef.current) return;');
  });
});
