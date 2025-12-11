export function buildConversationId(userA: string, userB: string): string {
  const [first, second] = [String(userA), String(userB)].sort();
  return `dm:${first}__${second}`;
}
