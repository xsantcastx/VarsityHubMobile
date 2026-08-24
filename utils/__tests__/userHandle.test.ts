import { formatUserHandle, hasRealUsername, isInternalId, userHandleInitial } from '../userHandle';

describe('userHandle — real handles must never be hidden as "@user"', () => {
  // The exact class of usernames the old vowel-pair heuristic wrongly ate:
  // 8+ chars, all lowercase-alphanumeric, no consecutive vowel pair.
  const realHandles = ['jfranc15', 'johnsmith', 'mikejones', 'superfan', 'jacobgflamm'];

  it.each(realHandles)('shows @%s, never @user', uname => {
    expect(isInternalId(uname)).toBe(false);
    expect(hasRealUsername({ username: uname })).toBe(true);
    expect(formatUserHandle({ username: uname })).toBe(`@${uname}`);
    expect(formatUserHandle({ username: uname }, { at: false })).toBe(uname);
    expect(userHandleInitial({ username: uname })).toBe(uname[0].toUpperCase());
  });

  it('still treats a raw CUID stored as a username as an internal id', () => {
    const cuid = 'ckv9v3f2a0000abcd1234efgh';
    expect(isInternalId(cuid)).toBe(true);
    expect(formatUserHandle({ username: cuid })).toBe('@user');
    expect(hasRealUsername({ username: cuid })).toBe(false);
  });

  it('still treats a raw UUID stored as a username as an internal id', () => {
    const uuid = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    expect(isInternalId(uuid)).toBe(true);
    expect(formatUserHandle({ username: uuid })).toBe('@user');
  });

  it('falls back to @user only when there is genuinely no username', () => {
    expect(formatUserHandle(null)).toBe('@user');
    expect(formatUserHandle({ username: null })).toBe('@user');
    expect(formatUserHandle({ username: '   ' })).toBe('@user');
    expect(hasRealUsername({ username: '' })).toBe(false);
  });
});
