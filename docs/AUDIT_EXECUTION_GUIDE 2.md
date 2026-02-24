# System Architecture Audit - Execution Guide

## 🚀 Quick Start

### Run the Audit

```bash
# Install dependencies if needed
npm install

# Run the comprehensive audit
npx tsx scripts/system-architecture-audit.ts
```

### Review Results

The audit generates:
1. **Console Output**: Summary of findings by severity
2. **JSON Report**: `docs/SYSTEM_ARCHITECTURE_AUDIT_REPORT.json` - Detailed findings

---

## 📊 What the Audit Checks

### 1. Security Gaps
- ✅ Missing authentication middleware on protected routes
- ✅ SQL injection risks (raw queries)
- ✅ Missing input validation (Zod schemas)
- ✅ Missing authorization checks (ownership, roles)
- ✅ Missing rate limiting on auth endpoints

### 2. Validation Mismatches
- ✅ Frontend vs backend validation inconsistencies
- ✅ Missing email validation
- ✅ Missing input sanitization (`.trim()`)
- ✅ Missing length limits on text fields

### 3. Architectural Inconsistencies
- ✅ Inconsistent error handling patterns
- ✅ Missing database transactions for multi-step operations
- ✅ Inconsistent middleware usage
- ✅ Missing structured logging

### 4. Permissions & Authorization
- ✅ Incomplete role checks
- ✅ Missing ownership verification
- ✅ Subscription tier limits not enforced

---

## 🔍 Manual Review Checklist

After running the automated audit, manually review:

### Critical Security Checks
- [ ] All update/delete endpoints verify ownership
- [ ] All authentication endpoints have rate limiting
- [ ] No raw SQL queries without parameterization
- [ ] All email fields use proper validation

### Validation Checks
- [ ] Frontend validation matches backend schemas
- [ ] All string fields use `.trim()`
- [ ] All text fields have max length limits

### Architecture Checks
- [ ] Multi-step DB operations use transactions
- [ ] Error responses are standardized
- [ ] Middleware patterns are consistent

---

## 📝 Interpreting Results

### Severity Levels

- **🔴 CRITICAL**: Immediate security risk - fix immediately
- **🟠 HIGH**: Security concern - fix soon
- **🟡 MEDIUM**: Best practice violation - plan to fix
- **🔵 LOW**: Code quality improvement - nice to have
- **ℹ️ INFO**: Documentation or style issue

### Example Finding

```json
{
  "severity": "HIGH",
  "category": "Security - Missing Authentication",
  "file": "server/src/routes/example.ts",
  "issue": "Route POST /example may be missing authentication middleware",
  "recommendation": "Add requireAuth or requireVerified middleware"
}
```

---

## 🛠️ Fixing Findings

### Finding: Missing Authentication
**Fix**: Add middleware to route
```typescript
// Before
router.post('/example', async (req, res) => { ... });

// After
router.post('/example', requireAuth as any, async (req, res) => { ... });
```

### Finding: Missing Input Validation
**Fix**: Add Zod schema
```typescript
const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

router.post('/example', async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  // ... use parsed.data
});
```

### Finding: Missing Ownership Check
**Fix**: Verify ownership before update/delete
```typescript
const item = await prisma.item.findUnique({ where: { id } });
if (!item || item.owner_id !== req.user.id) {
  return res.status(403).json({ error: 'Forbidden' });
}
```

---

## 🔄 Continuous Auditing

### When to Run
- Before major releases
- After adding new routes
- After security updates
- Monthly for ongoing projects

### Integration
Add to CI/CD pipeline:
```yaml
- name: Run Security Audit
  run: npx tsx scripts/system-architecture-audit.ts
```

---

## 📚 Related Documentation

- `docs/SYSTEM_ARCHITECTURE_AUDIT.md` - Detailed audit methodology
- `BACKEND_BUSINESS_RULES.md` - Business rule enforcement
- `.docs/guides/MOBILE_SECURITY_HARDENING.md` - Security checklist

---

## ⚠️ Important Notes

- Automated audits may produce false positives
- Manual review is required for all findings
- Focus on CRITICAL and HIGH severity first
- Some findings may be intentional (document why)

---

## 🆘 Troubleshooting

### Script fails to run
- Check Node.js version (requires 18+)
- Install dependencies: `npm install`
- Check file permissions

### Too many findings
- Start with CRITICAL and HIGH severity
- Review false positives and update script
- Focus on security-related findings first

### Missing dependencies
```bash
npm install glob tsx
```
