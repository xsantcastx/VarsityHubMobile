# Scrub leaked `.env` files from git history

**Read this whole document before running any command.** History
rewrites are destructive, force-push to `main` invalidates every
collaborator's local clone, and there is no safe rollback once the
new history is on origin.

## Background

Commit `97a715ee` (and several smaller commits — `234a1f24`, `ec6195da`,
`02f33e8f`, `b2c1b626`) tracked `.env` and/or `server/.env` in git
history before they were added to `.gitignore`. The dangerous one is
`97a715ee`, which contained `server/.env` with these production
secrets:

| Key | Risk class |
|---|---|
| `JWT_SECRET` | All session tokens forgeable |
| `STRIPE_SECRET_KEY` | Charges, refunds, payouts |
| `STRIPE_WEBHOOK_SECRET` | Forge webhook events |
| `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` | Full bucket access |
| `DATABASE_URL` | Full DB read/write if reachable |
| `GOOGLE_MAPS_API_KEY` | Quota theft, billable |
| `SMTP_PASS` | Outbound mail impersonation |

## ROTATE FIRST. Scrub second (optional).

The secrets are **already in the wild** the moment they hit a public
git history. Scrubbing only prevents *future* readers from fetching
them — anyone who already cloned, forked, or `git fetch`'d has them
forever.

So the first and only required action is rotation. Scrubbing is
defense-in-depth: it removes the easy-to-discover copy. Skip
scrubbing entirely if you are OK with that residual risk.

The rotation checklist lives in [Phase 1 of the audit
plan](#) — execute it before reading further.

---

## When to scrub

Scrub if **all** of these are true:

- Every secret listed above has been rotated AND the old values are
  inactive in their respective providers.
- You can coordinate with every collaborator (everyone with a clone)
  to discard their local repo and re-clone after the rewrite.
- No public forks exist that you care about (forks retain the old
  history).
- You have a fresh `git clone --mirror` backup of the repository
  somewhere offline, in case the rewrite goes wrong.

If any of those is "no" or "unsure," **do not scrub**. The cost-benefit
shifts hard: a botched rewrite breaks the team for a day, while the
benefit (one fewer lookup point for already-rotated secrets) is
modest.

---

## Procedure

### 1. Backup

```bash
cd /tmp
git clone --mirror https://github.com/xsantcastx/VarsityHubMobile VarsityHubMobile-backup-$(date +%Y%m%d)
```

Verify the backup is complete:

```bash
git -C VarsityHubMobile-backup-* log --all --oneline | wc -l
```

The number should match `git -C <your-clone> log --all --oneline | wc -l`.

### 2. Verify no in-flight work would be lost

```bash
gh pr list --state open --json number,headRefName,baseRefName
git branch -a
```

Every open PR will need to be closed and re-opened against the
rewritten history. Plan accordingly.

### 3. Install `git filter-repo`

`git filter-branch` is deprecated and slow. Use `git-filter-repo`:

```bash
brew install git-filter-repo
```

### 4. Run on a fresh clone

Never run filter-repo on your working clone — it intentionally cripples
the remote-tracking config to prevent accidental force-pushes.

```bash
mkdir /tmp/scrub-work && cd /tmp/scrub-work
git clone https://github.com/xsantcastx/VarsityHubMobile
cd VarsityHubMobile

# Remove the two paths from every commit they ever appeared in.
git filter-repo \
  --invert-paths \
  --path .env \
  --path server/.env \
  --force
```

This rewrites every commit that touched either path. SHAs of every
subsequent commit change.

### 5. Verify the rewrite

```bash
# These should now return zero hits.
git log --all --oneline -- .env
git log --all --oneline -- server/.env

# Confirm the working tree still builds.
npm install
npm test
cd server && npm install && npm test
```

If anything fails, **stop**. Restore from the backup mirror; do not
push.

### 6. Coordinate the force-push

Slack / message every contributor:

> Force-push to main planned at <TIME>. After it lands, your existing
> clone is dead — `git status` will look fine but you'll be on the old
> history. To recover:
> 1. Save any uncommitted work as a patch: `git diff > /tmp/work.patch`
> 2. Delete your clone: `cd .. && rm -rf VarsityHubMobile`
> 3. Re-clone fresh: `git clone <url>`
> 4. Re-apply your patch on top of the new main.

### 7. Force-push

```bash
# Re-add the original remote (filter-repo strips it on purpose).
git remote add origin https://github.com/xsantcastx/VarsityHubMobile

# Push every branch.
git push --force --all origin
git push --force --tags origin
```

### 8. GitHub-side cleanup

Even after the force-push, GitHub keeps the old commits reachable via
their hashes for 90 days (the dangling-commit grace window). To force
GitHub to drop them sooner, contact GitHub Support — they can run
`git gc` server-side. Without that, `https://github.com/.../commit/97a715ee`
still resolves.

### 9. CI / external integrations

- Re-trigger CI on the new `main` HEAD so the dashboard isn't pinned
  to a now-orphaned SHA.
- Re-issue any deploy keys / OAuth app tokens whose history references
  point to old SHAs (rare).
- Re-create any open PRs against the new history.

---

## What scrubbing does **not** fix

- **Anyone who already cloned has the secrets.** That's why rotation
  comes first.
- **Forks retain the old history**, including the secrets. There is no
  way to scrub forks you don't control.
- **GitHub caches** the old commits for 90 days minimum. The
  `commit/<sha>` URL keeps working.
- **Search engines** may have indexed code-search results from the
  old history. `https://github.com/search?q=...` results are not
  retroactively cleaned.

This is why the order is **rotate → restrict → (maybe) scrub**, not
the other way around.

---

## If you don't scrub

That's a defensible choice. Document the decision somewhere durable
(this file, a security ticket, a CLAUDE.md note) so a future engineer
doesn't re-discover the issue and assume it was overlooked. The
mitigations that ARE in place after rotation:

- Old secret values are inert in their providers (no longer accepted).
- `.env` and `server/.env` are now gitignored — no new leaks via this
  vector.
- The pre-commit + CI gitleaks check (Phase 2.3) prevents anyone from
  re-introducing tracked secrets.

That's a reasonable security posture even with the old commits intact.
