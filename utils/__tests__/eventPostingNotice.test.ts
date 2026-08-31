import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  markEventPostingNoticeSeen,
  shouldShowEventPostingNotice,
} from '@/utils/eventPostingNotice';

/**
 * Owner rule (2026-07-16): the posting-rules notice shows on a user's FIRST
 * post to an event page and never again — "a fan posting 13 times shouldn't see
 * it 13 times".
 */
describe('eventPostingNotice', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows once, then never again for the same (user, event)', async () => {
    expect(await shouldShowEventPostingNotice('u1', ['game-1'])).toBe(true);

    await markEventPostingNoticeSeen('u1', ['game-1']);

    // The 2nd through 13th post must stay silent.
    for (let i = 0; i < 12; i++) {
      expect(await shouldShowEventPostingNotice('u1', ['game-1'])).toBe(false);
    }
  });

  it('is per-event: a different event still gets its own notice', async () => {
    await markEventPostingNoticeSeen('u1', ['game-1']);

    expect(await shouldShowEventPostingNotice('u1', ['game-1'])).toBe(false);
    expect(await shouldShowEventPostingNotice('u1', ['game-2'])).toBe(true);
  });

  it('is per-user: a second account on the same device is still told the rules', async () => {
    await markEventPostingNoticeSeen('u1', ['game-1']);

    // Seen-state is the only source of truth for the notice, so it must be
    // keyed per user or u2 would silently never read it.
    expect(await shouldShowEventPostingNotice('u2', ['game-1'])).toBe(true);
  });

  it('treats game id and event id as the same page', async () => {
    // A post recorded under the game id must not re-show the notice when the
    // same page is later addressed by its event id.
    await markEventPostingNoticeSeen('u1', ['game-1', 'event-1']);

    expect(await shouldShowEventPostingNotice('u1', ['event-1'])).toBe(false);
    expect(await shouldShowEventPostingNotice('u1', ['game-1', 'event-1'])).toBe(false);
  });

  it('stays silent rather than nagging when there is nothing to key on', async () => {
    expect(await shouldShowEventPostingNotice(null, ['game-1'])).toBe(false);
    expect(await shouldShowEventPostingNotice('u1', [])).toBe(false);
    expect(await shouldShowEventPostingNotice('u1', [null, undefined, ''])).toBe(false);
  });

  it('never throws when storage fails', async () => {
    const getItem = jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValue(new Error('storage unavailable'));
    const setItem = jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValue(new Error('storage unavailable'));

    // Unreadable storage skips the reminder rather than nagging every post.
    await expect(shouldShowEventPostingNotice('u1', ['game-1'])).resolves.toBe(false);
    await expect(markEventPostingNoticeSeen('u1', ['game-1'])).resolves.toBeUndefined();

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
