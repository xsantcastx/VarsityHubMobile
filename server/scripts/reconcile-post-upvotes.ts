import 'dotenv/config';
import { runPostUpvoteReconciliation } from '../src/lib/postUpvoteReconciliation.js';

async function main() {
  const limit = Number(process.env.POST_UPVOTE_RECONCILE_LIMIT || '500');
  const result = await runPostUpvoteReconciliation(limit);
  console.log(
    `[post-upvote-reconcile] scanned=${result.scanned} fixed=${result.fixed} skipped=${result.skipped}`
  );
}

main().catch(err => {
  console.error('[post-upvote-reconcile] failed:', err);
  process.exitCode = 1;
});
