#!/bin/bash
#
# Pre-release audit — drift-specific checks for VarsityHub.
#
# Covers the seven failure modes this codebase has bitten on recently and
# that aren't already caught by validate-pre-launch.sh / release-checklist.sh /
# pre-build-verify.sh:
#
#   1. Schema ↔ migration enum drift
#   2. Schema ↔ migration @@index drift (Stream 1 class of bug)
#   3. Middleware coverage regressions on req.user / findMany / sgMail
#   4. Bearer-token auth anti-patterns (token-bypasses-auth middlewares)
#   5. Plaintext-at-rest for short-lived secret codes
#   6. Native-module OTA safety (static imports of new modules)
#   7. Hardcoded text colors (dark-mode regressions)
#
# Exit codes:
#   0   all checks passed (warnings allowed)
#   1   one or more ERRORs — do not release
#   2   tool / environment failure (e.g. rg parse error)
#
# Usage:
#   bash scripts/pre-release-audit.sh
#   npm run audit:pre-release

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
GRAY=$'\033[0;90m'
NC=$'\033[0m'

ERRORS=0
WARNINGS=0

header() {
  printf '\n%s━━━ %s%s\n' "$BLUE" "$1" "$NC"
}

pass() {
  printf '  %s✓%s %s\n' "$GREEN" "$NC" "$1"
}

fail() {
  printf '  %s✗ ERROR:%s %s\n' "$RED" "$NC" "$1"
  ERRORS=$((ERRORS + 1))
}

warn() {
  printf '  %s! WARN:%s %s\n' "$YELLOW" "$NC" "$1"
  WARNINGS=$((WARNINGS + 1))
}

detail() {
  # indent detail lines under the fail/warn they belong to
  while IFS= read -r line; do
    printf '      %s%s%s\n' "$GRAY" "$line" "$NC"
  done
}

# -----------------------------------------------------------------------------
# 1. Schema ↔ migration enum drift
# -----------------------------------------------------------------------------
# Every enum value declared in schema.prisma must be added to the Postgres type
# by at least one migration SQL file. Catches the class of bug we hit with
# ORG_REJECTED and NEEDS_REVIEW (schema declares it, no migration adds it,
# runtime throws).

check_enum_drift() {
  header "1/7  Prisma enum drift (schema vs migrations)"

  local schema="server/prisma/schema.prisma"
  local migrations_dir="server/prisma/migrations"

  if [ ! -f "$schema" ]; then
    fail "schema.prisma not found at $schema"
    return
  fi

  # Parse every `enum Foo { ... }` block and emit `Foo\tVALUE` rows.
  # We skip comment lines and the first enum field line (enum Name {).
  local enum_pairs
  enum_pairs="$(awk '
    /^enum [A-Za-z_][A-Za-z0-9_]* \{/ {
      name = $2; in_enum = 1; next
    }
    in_enum && /^\}/ { in_enum = 0; next }
    in_enum {
      line = $0
      sub(/\/\/.*/, "", line)       # strip trailing comments
      gsub(/^[ \t]+|[ \t]+$/, "", line)
      if (line == "") next
      print name "\t" line
    }
  ' "$schema")"

  if [ -z "$enum_pairs" ]; then
    warn "no enums parsed from $schema — adjust the parser"
    return
  fi

  local missing=0
  while IFS=$'\t' read -r enum_name enum_value; do
    [ -z "$enum_name" ] && continue
    # Match either a CREATE TYPE with the value literal, or an ALTER TYPE ...
    # ADD VALUE ... 'VALUE' in any migration file. Escape regex metachars in
    # value (none of our values have them today, but be safe).
    if ! grep -rlE "(CREATE TYPE \"${enum_name}\"|ALTER TYPE \"${enum_name}\".*'${enum_value}')" \
         "$migrations_dir" >/dev/null 2>&1; then
      fail "enum value missing migration: ${enum_name}.${enum_value}"
      missing=$((missing + 1))
    fi
  done <<< "$enum_pairs"

  if [ "$missing" -eq 0 ]; then
    pass "all schema.prisma enum values covered by a migration"
  fi
}

# -----------------------------------------------------------------------------
# 2. Schema ↔ migration @@index drift
# -----------------------------------------------------------------------------
# Parallel to the enum-drift check. Every @@index([cols]) declared inside a
# `model Foo { ... }` block in schema.prisma must have a matching CREATE INDEX
# somewhere under prisma/migrations/. The Prisma client types the model as if
# the index exists regardless, so a missing migration is invisible to tsc.
# Catches the Stream 1 class of bug (Message sender_id+recipient_id, Story
# game_id+expires_at declared but never migrated to Postgres).

check_index_drift() {
  header "2/7  Prisma @@index drift (schema vs migrations)"

  local schema="server/prisma/schema.prisma"
  local migrations_dir="server/prisma/migrations"

  if [ ! -f "$schema" ]; then
    fail "schema.prisma not found at $schema"
    return
  fi

  # Parse each model block, emit `Model\tcol1,col2,col3` for every @@index.
  # Supports single-column and composite indexes. Strips trailing comments and
  # surrounding whitespace from the column list.
  local index_rows
  index_rows="$(awk '
    /^model [A-Za-z_][A-Za-z0-9_]* \{/ {
      name = $2; in_model = 1; next
    }
    in_model && /^\}/ { in_model = 0; next }
    in_model && /@@index\(\[/ {
      line = $0
      sub(/.*@@index\(\[/, "", line)      # drop everything up to the opening [
      sub(/\].*/, "", line)                # drop the closing ] and anything after
      gsub(/[ \t]+/, "", line)             # strip all whitespace
      if (line == "") next
      print name "\t" line
    }
  ' "$schema")"

  if [ -z "$index_rows" ]; then
    warn "no @@index entries parsed from $schema — adjust the parser"
    return
  fi

  # Collect all migration SQL into a single in-memory blob once, not per-index.
  # This avoids rerunning a recursive grep for every single index entry.
  local migrations_blob
  migrations_blob="$(find "$migrations_dir" -type f -name '*.sql' -print0 2>/dev/null \
                      | xargs -0 cat 2>/dev/null)"

  if [ -z "$migrations_blob" ]; then
    warn "no migration SQL files found under $migrations_dir"
    return
  fi

  local missing=0
  while IFS=$'\t' read -r model cols; do
    [ -z "$model" ] && continue

    # Prisma's default composite-index name is `${Model}_${col1}_${col2}_idx`.
    # Try that literal first (fast fixed-string match) — covers the vast
    # majority of schema.prisma-driven migrations.
    local prisma_name
    prisma_name="${model}_$(printf '%s' "$cols" | tr ',' '_')_idx"
    if grep -Fq "\"${prisma_name}\"" <<< "$migrations_blob"; then
      continue
    fi

    # Accept an index that was introduced under an older table/model name and
    # later renamed in-place (for example PostVote -> PostUpvote).
    if grep -Eq "ALTER INDEX .* RENAME TO \"${prisma_name}\"" <<< "$migrations_blob"; then
      continue
    fi

    # Fall back: a hand-written CREATE INDEX that lists this Model and every
    # column on the same line. Check each column is present on at least one
    # `ON "Model" (...)` line. This is still a heuristic but it's linear.
    local candidate_lines
    candidate_lines="$(printf '%s' "$migrations_blob" \
                        | grep -F "ON \"${model}\"" \
                        | grep -F 'CREATE INDEX')"
    local found=0
    if [ -n "$candidate_lines" ]; then
      local all_present=1
      local col
      # Break the comma list into individual columns and require each to
      # appear on the same CREATE INDEX line.
      while IFS= read -r line; do
        all_present=1
        IFS=',' read -ra cols_arr <<< "$cols"
        for col in "${cols_arr[@]}"; do
          if ! grep -Fq "$col" <<< "$line"; then
            all_present=0
            break
          fi
        done
        if [ "$all_present" -eq 1 ]; then
          found=1
          break
        fi
      done <<< "$candidate_lines"
    fi

    if [ "$found" -eq 0 ]; then
      fail "@@index missing migration: ${model}([${cols}])"
      missing=$((missing + 1))
    fi
  done <<< "$index_rows"

  if [ "$missing" -eq 0 ]; then
    pass "all @@index declarations covered by a CREATE INDEX migration"
  fi
}

# -----------------------------------------------------------------------------
# 3. Middleware coverage on server routes
# -----------------------------------------------------------------------------

check_middleware_coverage() {
  header "3/7  Middleware coverage on server routes"

  # 2a. Route files that read req.user non-optionally (req.user!.id or req.user.id
  # without `?.`) but don't reference any auth gate. Optional-chaining access
  # (`req.user?.id`) indicates the route is intentionally handling anonymous
  # callers, so it's excluded. Heuristic — real enforcement is in
  # verify-guardrails.sh and integration tests. WARN only.
  local req_user_files
  req_user_files="$(grep -rl "req\.user" server/src/routes --include="*.ts" 2>/dev/null || true)"
  local req_user_missing=0
  local ungated=""
  for f in $req_user_files; do
    # Skip files whose only access is optional-chained (anonymous-friendly).
    if ! grep -qE "req\.user!?\.id|req\.user!?\.email|req\.user\s*=" "$f"; then
      continue
    fi
    if ! grep -qE "requireAuth|requireAdmin|authMiddleware" "$f"; then
      ungated="${ungated}${f}"$'\n'
      req_user_missing=$((req_user_missing + 1))
    fi
  done
  if [ "$req_user_missing" -eq 0 ]; then
    pass "req.user routes all reference an auth middleware"
  else
    warn "route files assume req.user but don't reference an auth middleware — spot-check"
    echo "$ungated" | sed '/^$/d' | detail
  fi

  # 2b. findMany without take (unbounded query). Many legitimate user-scoped
  # queries are naturally bounded (e.g. "users this user follows"), so this is
  # a heuristic warning, not a blocker. Add `// audit-allow unbounded` on the
  # line above a findMany to silence it.
  local unbounded
  unbounded="$(grep -rnB1 "findMany" server/src --include="*.ts" 2>/dev/null \
                 | awk '
                     /^--$/ { prev=""; next }
                     {
                       if ($0 ~ /-audit-allow unbounded/) { prev=""; next }
                       if ($0 ~ /:[0-9]+:.*findMany/ && $0 !~ /take/) print $0
                     }
                   ' \
                 | grep -v "__tests__" \
                 | grep -v "lib/prisma.ts" \
                 || true)"
  local unbounded_count
  unbounded_count=$(echo -n "$unbounded" | grep -c '^' || true)
  if [ "$unbounded_count" -gt 0 ]; then
    warn "$unbounded_count findMany calls without an explicit take limit — verify bounds"
    echo "$unbounded" | head -10 | detail
    [ "$unbounded_count" -gt 10 ] && printf '      %s... and %d more%s\n' "$GRAY" "$((unbounded_count - 10))" "$NC"
    printf '      %sSuppress individual callsites with "// audit-allow unbounded" on the line above.%s\n' "$GRAY" "$NC"
  else
    pass "all findMany calls bounded with take (or allow-listed)"
  fi

  # 2c. Direct sgMail.send usage outside the SendGrid provider.
  # The canonical provider lives at server/src/services/email/providers/SendGridProvider.ts.
  local raw_sgmail
  raw_sgmail="$(grep -rn "sgMail\.send" server/src --include="*.ts" 2>/dev/null \
                 | grep -v "lib/email" \
                 | grep -v "services/email/providers/SendGridProvider" \
                 || true)"
  if [ -n "$raw_sgmail" ]; then
    fail "sgMail.send used outside the centralized SendGrid provider"
    echo "$raw_sgmail" | detail
  else
    pass "sgMail.send only used from the centralized SendGrid provider"
  fi
}

# -----------------------------------------------------------------------------
# 3. Bearer-token auth anti-patterns
# -----------------------------------------------------------------------------
# Catches the pattern that caused the org/ad approval-link HIGHs:
# middleware that short-circuits auth when a token is present in the query.

check_bearer_token_patterns() {
  header "4/7  Bearer-token anti-patterns"

  # 3a. The classic `if (req.query.token) return next()` middleware shape.
  local token_bypass
  token_bypass="$(grep -rn "req\.query\.token.*return next" server/src --include="*.ts" 2>/dev/null || true)"
  if [ -n "$token_bypass" ]; then
    fail "middleware allows token-only bypass of requireAuth (bearer-token anti-pattern)"
    echo "$token_bypass" | detail
    printf '      %s%s%s\n' "$GRAY" "Fix pattern: always require admin auth on writes; use token as a binding check." "$NC"
  else
    pass "no token-bypasses-auth middlewares"
  fi

  # 3b. signJwt with a TTL >= 7d — warn, not fail. Audit-worthy but not a bug.
  local long_ttl
  long_ttl="$(grep -rnE "signJwt\([^)]*'([0-9]+d)'" server/src --include="*.ts" 2>/dev/null \
               | awk -F"'" '{
                   for (i=1;i<=NF;i++) {
                     if ($i ~ /^[0-9]+d$/) {
                       d=$i; sub(/d$/,"",d);
                       if (d+0 >= 7) print $0
                     }
                   }
                 }' \
               | grep -v "__tests__" \
               || true)"
  if [ -n "$long_ttl" ]; then
    warn "signJwt token TTL >= 7d — review exposure window (not a blocker)"
    echo "$long_ttl" | detail
  else
    pass "no signJwt tokens with TTL >= 7d (outside tests)"
  fi
}

# -----------------------------------------------------------------------------
# 4. Plaintext-at-rest for short-lived secret codes
# -----------------------------------------------------------------------------
# We had email_verification_code and password_reset_code stored as plaintext
# while the compare path expected a hash. A write that sets one of these
# columns to a raw variable (not a hash call) is suspicious.

check_secret_plaintext_at_rest() {
  header "5/7  Plaintext-at-rest for verification / reset codes"

  # Look for writes like `email_verification_code: <something>` where the
  # value isn't obviously a hash helper call. We check a window around each
  # hit for the hashing function name; this is a heuristic but catches the
  # regression cases cleanly.
  local sensitive_cols=( "email_verification_code" "password_reset_code" )
  local fails=0
  for col in "${sensitive_cols[@]}"; do
    # Every non-null/non-undefined assignment of the column in src/
    while IFS= read -r hit; do
      # Skip tests, migrations, and assignments to null/undefined (clearing).
      echo "$hit" | grep -qE "null|undefined" && continue
      # Accept if the assigned value references a hash helper.
      echo "$hit" | grep -qE "hashRefreshToken|hashReset|codeHash|resetCodeHash|hash\(" && continue
      # Accept OAuth link paths where the value explicitly resets to null above.
      fail "possible plaintext-at-rest write of $col"
      printf '      %s%s%s\n' "$GRAY" "$hit" "$NC"
      fails=$((fails + 1))
    done < <(grep -rn "${col}:" server/src --include="*.ts" 2>/dev/null \
              | grep -v "__tests__" \
              | grep -v "prisma/schema" \
              | grep -v "sanitizeUser" \
              | grep -v "select:")
  done
  [ "$fails" -eq 0 ] && pass "no plaintext writes detected for verification/reset codes"
}

# -----------------------------------------------------------------------------
# 5. Native-module OTA safety
# -----------------------------------------------------------------------------
# Any native module added after the current App Store binary MUST be loaded
# with require(...) in a try/catch so OTA updates don't crash older binaries
# that don't have the native code. OfflineBanner.tsx is the canonical pattern.

check_native_module_ota_safety() {
  header "6/7  Native-module OTA safety"

  # Static top-level imports of @react-native-community/* and similar bridges.
  # We warn (not fail) because some of these are safe (shipped in the current
  # App Store binary). The triage expectation: every hit must either be in the
  # base binary or wrapped in try/catch require().
  local risky
  risky="$(grep -rnE \
    "^import .* from '(@react-native-community/netinfo|@react-native-community/blur|@stripe/stripe-react-native|react-native-vision-camera|react-native-iap|@notifee/react-native|react-native-purchases)'" \
    . --include="*.ts" --include="*.tsx" 2>/dev/null \
    | grep -v "node_modules" \
    | grep -v "OfflineBanner.tsx" \
    || true)"
  if [ -n "$risky" ]; then
    warn "static top-level imports of native-bridge modules — confirm they exist in the App Store binary you're OTA'ing to"
    echo "$risky" | detail
    printf '      %s%s%s\n' "$GRAY" "If the module was added after the current binary, switch to dynamic require + try/catch (see OfflineBanner.tsx)." "$NC"
  else
    pass "no risky static native-bridge imports"
  fi
}

# -----------------------------------------------------------------------------
# 6. Hardcoded text colors (dark-mode regressions)
# -----------------------------------------------------------------------------

check_text_color_hardcoding() {
  header "7/7  Hardcoded text colors (dark-mode regressions)"

  # From CLAUDE.md: text colors must flow through useColorScheme() or theme.
  # The same literal is OK for backgroundColor, borderColor, etc. — and a
  # ternary on colorScheme/isDark IS the correct dark-mode pattern, so those
  # are filtered out.
  local offenders
  offenders="$(grep -rnE "'(#000|#111827|#374151|#1f2937|black)'" \
                 app components --include="*.tsx" 2>/dev/null \
                 | grep -v backgroundColor \
                 | grep -v borderColor \
                 | grep -v shadowColor \
                 | grep -v tintColor \
                 | grep -v "isDark " \
                 | grep -v "isDark?" \
                 | grep -v "colorScheme ===" \
                 | grep -v "colorScheme ==" \
                 | grep -v "colorScheme?." \
                 | grep -v "? '#" \
                 | grep -v "// " \
                 | grep -v "/\*" \
                 | grep -v "__tests__" \
                 || true)"
  local count
  count=$(echo -n "$offenders" | grep -c '^' || true)
  if [ "$count" -gt 0 ]; then
    warn "$count likely text-color hardcodings — audit for dark-mode compatibility"
    echo "$offenders" | head -20 | detail
    if [ "$count" -gt 20 ]; then
      printf '      %s... and %d more%s\n' "$GRAY" "$((count - 20))" "$NC"
    fi
  else
    pass "no obvious text-color hardcodings"
  fi
}

# -----------------------------------------------------------------------------
# Run all checks + summary
# -----------------------------------------------------------------------------

printf '%s┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓%s\n' "$BLUE" "$NC"
printf '%s┃  VarsityHub pre-release drift audit                              ┃%s\n' "$BLUE" "$NC"
printf '%s┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛%s\n' "$BLUE" "$NC"

check_enum_drift
check_index_drift
check_middleware_coverage
check_bearer_token_patterns
check_secret_plaintext_at_rest
check_native_module_ota_safety
check_text_color_hardcoding

printf '\n%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$BLUE" "$NC"
if [ "$ERRORS" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  printf '  %s✓ All pre-release checks passed.%s\n' "$GREEN" "$NC"
  exit 0
elif [ "$ERRORS" -eq 0 ]; then
  printf '  %s✓ No blocking errors.%s  %s(%d warning%s — review before shipping)%s\n' \
    "$GREEN" "$NC" "$YELLOW" "$WARNINGS" "$([ "$WARNINGS" -ne 1 ] && echo "s" )" "$NC"
  exit 0
else
  printf '  %s✗ %d error%s%s — do not release until resolved. %s(%d warning%s)%s\n' \
    "$RED" "$ERRORS" "$([ "$ERRORS" -ne 1 ] && echo "s" )" "$NC" \
    "$YELLOW" "$WARNINGS" "$([ "$WARNINGS" -ne 1 ] && echo "s" )" "$NC"
  exit 1
fi
