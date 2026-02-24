# Overnight Tasks: Strengthen & Organize Your App

## 🎯 Overview

This document outlines automated overnight tasks that will systematically strengthen and organize your VarsityHub app. These tasks run while you sleep and provide actionable reports in the morning.

**Current Status:** You already have 6 overnight tasks running. This adds **10 new tasks** focused on code quality, performance, organization, and maintainability.

---

## 📋 New Overnight Tasks

### 1. **Code Organization & Cleanup** 🔧

#### 1.1 Unused Import Cleanup
**What it does:** Finds and reports unused imports across the codebase  
**Impact:** Reduces bundle size, improves code clarity  
**Script:** `scripts/overnight-unused-imports.sh`  
**Output:** `overnight-results/unused-imports-TIMESTAMP.json`

**Fixes:**
- Removes unused React imports
- Removes unused component imports
- Removes unused utility imports
- Reports files with 5+ unused imports (priority targets)

#### 1.2 Dead Code Detection
**What it does:** Identifies unreachable code, unused functions, and orphaned files  
**Impact:** Reduces maintenance burden, improves codebase clarity  
**Script:** `scripts/overnight-dead-code.sh`  
**Output:** `overnight-results/dead-code-TIMESTAMP.json`

**Detects:**
- Unused exported functions
- Unreachable code blocks
- Orphaned files (not imported anywhere)
- Unused type definitions

#### 1.3 Console.log Audit & Cleanup
**What it does:** Finds all console statements and reports which should be removed/wrapped  
**Impact:** Cleaner production logs, better debugging  
**Script:** `scripts/overnight-console-cleanup.sh`  
**Output:** `overnight-results/console-audit-TIMESTAMP.json`

**Reports:**
- Total console statements by type (log, error, warn)
- Files with 10+ console statements (priority cleanup)
- Console statements in production code paths
- Recommendations: remove vs wrap in `__DEV__`

---

### 2. **Performance Optimization** ⚡

#### 2.1 Database Query Performance Analysis
**What it does:** Analyzes slow queries, missing indexes, and N+1 problems  
**Impact:** Faster API responses, reduced database load  
**Script:** `scripts/overnight-db-performance.sh`  
**Output:** `overnight-results/db-performance-TIMESTAMP.json`

**Checks:**
- Queries without indexes on WHERE/ORDER BY columns
- N+1 query patterns (loops with database calls)
- Queries taking >100ms (slow query detection)
- Missing indexes on foreign keys
- Large result sets without pagination

**Example findings:**
```json
{
  "slowQueries": [
    {
      "file": "server/src/routes/posts.ts",
      "line": 48,
      "query": "prisma.post.findMany",
      "issue": "Missing index on author_id",
      "impact": "High - called on every feed load"
    }
  ],
  "nPlusOne": [
    {
      "file": "server/src/routes/teams.ts",
      "line": 168,
      "pattern": "Loop with prisma.teamMembership.findMany",
      "fix": "Use include or Promise.all"
    }
  ]
}
```

#### 2.2 Bundle Size Analysis
**What it does:** Tracks bundle size over time, identifies large dependencies  
**Impact:** Faster app startup, smaller downloads  
**Script:** `scripts/overnight-bundle-analysis.sh`  
**Output:** `overnight-results/bundle-size-TIMESTAMP.json`

**Tracks:**
- Total bundle size (iOS/Android)
- Largest dependencies
- Unused dependencies
- Code splitting opportunities
- Size trends (night-to-night comparison)

#### 2.3 API Response Time Monitoring
**What it does:** Tests critical endpoints and measures response times  
**Impact:** Early detection of performance degradation  
**Script:** `scripts/overnight-api-performance.sh`  
**Output:** `overnight-results/api-performance-TIMESTAMP.json`

**Monitors:**
- `/health` endpoint (<100ms target)
- `/posts` endpoint (<500ms target)
- `/games` endpoint (<300ms target)
- `/notifications` endpoint (<200ms target)
- Alerts if any endpoint exceeds 2x baseline

---

### 3. **Code Quality & Maintainability** 📚

#### 3.1 Floating Promise Fixer
**What it does:** Identifies and suggests fixes for floating promises  
**Impact:** Better error handling, prevents silent failures  
**Script:** `scripts/overnight-floating-promises.sh`  
**Output:** `overnight-results/floating-promises-TIMESTAMP.json`

**Finds:**
- Async calls without await/void
- Promise chains without .catch()
- Router.push() without void
- Files with 5+ floating promises (priority)

**Safe auto-fixes:**
- Router navigation → add `void`
- Fire-and-forget operations → add `void` + `.catch()`
- Critical operations → suggest `await` + error handling

#### 3.2 Code Duplication Detection
**What it does:** Finds duplicate code blocks that could be extracted  
**Impact:** Easier maintenance, consistent behavior  
**Script:** `scripts/overnight-code-duplication.sh`  
**Output:** `overnight-results/duplication-TIMESTAMP.json`

**Detects:**
- Duplicate functions (same logic, different files)
- Repeated code blocks (10+ lines, 80%+ similarity)
- Similar component patterns (could be shared components)
- Repeated validation logic

#### 3.3 Type Safety Audit
**What it does:** Finds `any` types, missing type definitions, unsafe casts  
**Impact:** Better IDE support, fewer runtime errors  
**Script:** `scripts/overnight-type-safety.sh`  
**Output:** `overnight-results/type-safety-TIMESTAMP.json`

**Reports:**
- `any` types by file (priority: frequently used files)
- Missing return types on functions
- Unsafe type assertions (`as any`)
- Missing generic type parameters

---

### 4. **Security & Dependencies** 🔒

#### 4.1 Dependency Update Checker
**What it does:** Checks for outdated dependencies with security patches  
**Impact:** Stays secure, gets bug fixes  
**Script:** `scripts/overnight-dependency-updates.sh` (exists, enhance)  
**Output:** `overnight-results/dependency-updates-TIMESTAMP.json`

**Checks:**
- Outdated packages (major/minor/patch)
- Security patches available
- Breaking changes in updates
- Update recommendations (safe vs risky)

#### 4.2 Environment Variable Audit
**What it does:** Verifies all required env vars are set, no hardcoded secrets  
**Impact:** Prevents deployment failures, improves security  
**Script:** `scripts/overnight-env-audit.sh`  
**Output:** `overnight-results/env-audit-TIMESTAMP.json`

**Validates:**
- All required env vars present
- No hardcoded API keys or secrets
- Consistent env var usage across files
- Missing env vars in production config

---

### 5. **Database Health & Optimization** 🗄️

#### 5.1 Database Index Analysis
**What it does:** Identifies missing indexes on frequently queried columns  
**Impact:** Faster queries, better scalability  
**Script:** `scripts/overnight-db-indexes.sh`  
**Output:** `overnight-results/db-indexes-TIMESTAMP.json`

**Analyzes:**
- WHERE clause columns without indexes
- ORDER BY columns without indexes
- Foreign keys without indexes
- Composite index opportunities

**Generates migration suggestions:**
```sql
-- Suggested index for posts.author_id
CREATE INDEX IF NOT EXISTS "Post_author_id_idx" ON "Post"("author_id");

-- Suggested composite index for games query
CREATE INDEX IF NOT EXISTS "Game_date_approval_idx" ON "Game"("date", "approval_status");
```

#### 5.2 Database Health Check
**What it does:** Monitors database connection, query performance, table sizes  
**Impact:** Early detection of database issues  
**Script:** `scripts/overnight-db-health.sh` (exists, enhance)  
**Output:** `overnight-results/db-health-TIMESTAMP.json`

**Checks:**
- Database connection health
- Table sizes (alerts if growing too fast)
- Long-running queries
- Lock contention
- Connection pool usage

---

### 6. **Documentation & Organization** 📖

#### 6.1 API Documentation Generator
**What it does:** Auto-generates/updates API documentation from code  
**Impact:** Always up-to-date API docs, easier onboarding  
**Script:** `scripts/overnight-api-docs.sh`  
**Output:** `docs/api/auto-generated-TIMESTAMP.md`

**Generates:**
- Endpoint list with methods
- Request/response schemas
- Authentication requirements
- Example requests/responses

#### 6.2 Component Documentation Audit
**What it does:** Finds components without JSDoc comments  
**Impact:** Better code understanding, easier maintenance  
**Script:** `scripts/overnight-component-docs.sh`  
**Output:** `overnight-results/missing-docs-TIMESTAMP.json`

**Reports:**
- Components without prop documentation
- Functions without JSDoc
- Complex components needing explanation
- Priority: shared/commonly used components

---

## 🚀 Implementation Plan

### Phase 1: Quick Wins (Week 1)
1. ✅ Unused Import Cleanup
2. ✅ Console.log Audit
3. ✅ Floating Promise Fixer (safe fixes only)
4. ✅ Environment Variable Audit

### Phase 2: Performance (Week 2)
5. ✅ Database Query Performance Analysis
6. ✅ Bundle Size Analysis
7. ✅ API Response Time Monitoring

### Phase 3: Quality & Security (Week 3)
8. ✅ Code Duplication Detection
9. ✅ Type Safety Audit
10. ✅ Database Index Analysis

### Phase 4: Documentation (Week 4)
11. ✅ API Documentation Generator
12. ✅ Component Documentation Audit

---

## 📊 Morning Review Checklist

When you wake up, check these reports:

```bash
cd /Users/varsityhub/VarsityHubMobile

# 1. Code Organization
echo "📦 Unused Imports:"
cat overnight-results/unused-imports-*.json | jq '.summary'

echo "🗑️ Dead Code:"
cat overnight-results/dead-code-*.json | jq '.unusedFunctions | length'

# 2. Performance
echo "⚡ Slow Queries:"
cat overnight-results/db-performance-*.json | jq '.slowQueries | length'

echo "📦 Bundle Size:"
cat overnight-results/bundle-size-*.json | jq '.totalSize'

# 3. Code Quality
echo "🔧 Floating Promises:"
cat overnight-results/floating-promises-*.json | jq '.total'

echo "📋 Code Duplication:"
cat overnight-results/duplication-*.json | jq '.duplicates | length'

# 4. Security
echo "🔒 Dependency Updates:"
cat overnight-results/dependency-updates-*.json | jq '.securityPatches'

# 5. Database
echo "🗄️ Missing Indexes:"
cat overnight-results/db-indexes-*.json | jq '.missingIndexes | length'
```

---

## 🎯 Success Metrics

Track these metrics over time:

| Metric | Current | Target | Priority |
|--------|---------|--------|----------|
| Unused imports | ~50 | <10 | High |
| Console statements | ~120 | <20 | Medium |
| Floating promises | ~114 | <30 | High |
| Slow queries (>100ms) | ? | 0 | Critical |
| Bundle size (MB) | ? | <50 | High |
| Missing indexes | ? | 0 | High |
| `any` types | ? | <50 | Medium |
| Code duplication | ? | <5% | Low |

---

## 🔧 Scripts to Create

I'll create these scripts for you:

1. `scripts/overnight-unused-imports.sh` - Find unused imports
2. `scripts/overnight-dead-code.sh` - Detect dead code
3. `scripts/overnight-console-cleanup.sh` - Console.log audit
4. `scripts/overnight-db-performance.sh` - Query performance
5. `scripts/overnight-bundle-analysis.sh` - Bundle size tracking
6. `scripts/overnight-api-performance.sh` - API response times
7. `scripts/overnight-floating-promises.sh` - Floating promise fixes
8. `scripts/overnight-code-duplication.sh` - Duplication detection
9. `scripts/overnight-type-safety.sh` - Type safety audit
10. `scripts/overnight-env-audit.sh` - Environment variable validation
11. `scripts/overnight-db-indexes.sh` - Database index analysis
12. `scripts/overnight-api-docs.sh` - API documentation generator
13. `scripts/overnight-component-docs.sh` - Component docs audit

---

## 📝 Next Steps

1. **Review this plan** - Which tasks are highest priority?
2. **I'll create the scripts** - Tell me which ones to build first
3. **Integrate with existing automation** - Add to nightly-sweeps.sh
4. **Set up cron** - Run automatically every night

Would you like me to start creating these scripts? I recommend starting with:
- Unused Import Cleanup (quick win)
- Database Query Performance (high impact)
- Floating Promise Fixer (code quality)
