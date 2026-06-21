/**
 * Verifies the shipped feed/posts serializer refactor against the REAL endpoints
 * + Postgres. Creates a post, upvotes + bookmarks it, then asserts GET /posts
 * returns the full serializeFeedPost shape with correct interaction state —
 * proving loadPostInteractionSets + serializeFeedPost wire up end-to-end, not
 * just in the unit test.
 *
 *   PORT=4000 npm run dev
 *   npx tsx scripts/feed-serializer-trace.ts
 */
import { prisma } from '../src/lib/prisma.js';

const BASE = process.env.BASE_URL || 'http://localhost:4000';

async function http(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, text };
}

async function main() {
  const email = `e2e_feed_${Date.now()}@test.varsityhub.app`;
  let userId = '';
  let postId = '';
  let pass = 0;
  let fail = 0;
  const check = (label: string, ok: boolean, detail?: unknown) => {
    console.log(`   ${ok ? '✅' : '❌'} ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`);
    ok ? pass++ : fail++;
  };

  try {
    // Setup: register + make an onboarded, verified fan.
    const reg = await http('POST', '/auth/register', {
      email,
      password: 'TestPass123!',
      display_name: 'E2E Feed User',
      role: 'fan',
    });
    userId = reg.data?.user?.id;
    const token = reg.data?.access_token;
    await prisma.user.update({
      where: { id: userId },
      data: { email_verified: true, onboarding_completed: true },
    });
    console.log(`\n▶ setup: user ${userId} (verified, onboarded)`);

    // Create a post.
    const create = await http('POST', '/posts', { content: 'E2E serializer test post' }, token);
    postId = create.data?.id;
    console.log('▶ create post', create.status, 'id:', postId);
    check('post created (201) with id', create.status === 201 && !!postId);

    // Upvote + bookmark it (populates the interaction sets).
    const up = await http('POST', `/posts/${postId}/upvote`, {}, token);
    const bm = await http('POST', `/posts/${postId}/bookmark`, {}, token);
    console.log('▶ upvote', up.status, '| bookmark', bm.status);
    check('upvote accepted', up.status >= 200 && up.status < 300);
    check('bookmark accepted', bm.status >= 200 && bm.status < 300);

    // Fetch the feed list and find our post — this runs loadPostInteractionSets
    // + serializeFeedPost over real DB rows.
    const list = await http('GET', '/posts?limit=20', undefined, token);
    const items = Array.isArray(list.data?.items) ? list.data.items : list.data;
    const post = (items as any[]).find(p => p.id === postId);
    console.log('\n▶ GET /posts → serialized post:');
    console.log(JSON.stringify(post, null, 2)?.slice(0, 600));

    check('post present in serialized feed', !!post);
    if (post) {
      // Every field the old inline serializer produced must still be present.
      const expectedKeys = [
        'id', 'author_id', 'team_id', 'is_pinned', 'title', 'content', 'media_url',
        'media_type', 'preview_url', 'caption', 'upvotes_count', 'comments_count',
        'bookmarks_count', 'created_at', 'author', 'has_upvoted', 'has_bookmarked',
        'is_following_author', 'poll',
      ];
      const missing = expectedKeys.filter(k => !(k in post));
      check('payload has all serializeFeedPost fields', missing.length === 0, missing.length ? { missing } : undefined);

      // The interaction sets must reflect the real upvote/bookmark we just did.
      check('has_upvoted === true (loadPostInteractionSets wired)', post.has_upvoted === true);
      check('has_bookmarked === true', post.has_bookmarked === true);
      check('upvotes_count reflects the upvote', post.upvotes_count >= 1, post.upvotes_count);
      check('caption falls back to content', post.caption === 'E2E serializer test post', post.caption);
      check('author shape present', !!post.author && typeof post.author.id === 'string');
    }
  } finally {
    if (postId) await prisma.post.deleteMany({ where: { id: postId } }).catch(() => {});
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    console.log('\n🧹 cleaned up');
    console.log(`\n═══ RESULT: ${pass} passed, ${fail} failed ═══`);
    await prisma.$disconnect();
    process.exit(fail > 0 ? 1 : 0);
  }
}

main().catch(err => {
  console.error('TRACE ERROR:', err);
  process.exit(1);
});
