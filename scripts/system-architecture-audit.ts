#!/usr/bin/env node
/**
 * Comprehensive System Architecture Audit
 * 
 * Focus Areas:
 * 1. Security Gaps (authentication, authorization, input validation)
 * 2. Validation Mismatches (frontend vs backend, schema inconsistencies)
 * 3. Architectural Inconsistencies (patterns, middleware, error handling)
 */

import * as fs from 'fs';
import { glob } from 'glob';
import * as path from 'path';

interface AuditFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  category: string;
  file: string;
  line?: number;
  issue: string;
  recommendation: string;
  code?: string;
}

const findings: AuditFinding[] = [];

function addFinding(
  severity: AuditFinding['severity'],
  category: string,
  file: string,
  issue: string,
  recommendation: string,
  line?: number,
  code?: string
) {
  findings.push({
    severity,
    category,
    file,
    line,
    issue,
    recommendation,
    code,
  });
}

// ============================================================================
// 1. SECURITY GAPS AUDIT
// ============================================================================

async function auditSecurityGaps() {
  console.log('🔒 Auditing Security Gaps...\n');

  const routeFiles = await glob('server/src/routes/**/*.ts');
  
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    // Check for missing authentication middleware
    const hasPostPutPatchDelete = /(post|put|patch|delete)\s*\(['"]/i.test(content);
    const hasRequireAuth = /requireAuth/i.test(content);
    const hasRequireVerified = /requireVerified/i.test(content);
    
    if (hasPostPutPatchDelete && !hasRequireAuth && !hasRequireVerified) {
      const routeMatch = content.match(/(post|put|patch|delete)\s*\(['"]([^'"]+)['"]/i);
      const routePath = routeMatch ? routeMatch[2] : 'unknown';
      
      // Skip health check and public endpoints
      if (!routePath.includes('health') && !routePath.includes('public')) {
        addFinding(
          'HIGH',
          'Security - Missing Authentication',
          file,
          `Route ${routePath.toUpperCase()} may be missing authentication middleware`,
          'Add requireAuth or requireVerified middleware to protect this endpoint',
          undefined,
          routeMatch ? routeMatch[0] : undefined
        );
      }
    }
    
    // Check for SQL injection risks (raw queries)
    if (/\$queryRaw|queryRawUnsafe|executeRaw/i.test(content)) {
      const lineNum = lines.findIndex((l, i) => /\$queryRaw|queryRawUnsafe|executeRaw/i.test(l));
      addFinding(
        'CRITICAL',
        'Security - SQL Injection Risk',
        file,
        'Raw SQL query detected - potential SQL injection vulnerability',
        'Use Prisma parameterized queries or validate all inputs before using raw queries',
        lineNum >= 0 ? lineNum + 1 : undefined,
        lines[lineNum]
      );
    }
    
    // Check for missing input validation
    const hasBodyParams = /req\.body|req\.query|req\.params/i.test(content);
    const hasZodValidation = /z\.object|z\.string|z\.number|\.safeParse|\.parse/i.test(content);
    
    if (hasBodyParams && !hasZodValidation && hasPostPutPatchDelete) {
      const routeMatch = content.match(/(post|put|patch)\s*\(['"]([^'"]+)['"]/i);
      if (routeMatch && !routeMatch[2].includes('health')) {
        addFinding(
          'HIGH',
          'Security - Missing Input Validation',
          file,
          `Route ${routeMatch[2]} accepts input without Zod validation`,
          'Add Zod schema validation for all request inputs',
          undefined
        );
      }
    }
    
    // Check for missing authorization checks
    const hasUserAccess = /req\.user|req\.user\.id/i.test(content);
    const hasOwnerCheck = /owner|creator|author/i.test(content);
    const hasRoleCheck = /role|admin|coach/i.test(content);
    
    if (hasUserAccess && (hasOwnerCheck || hasRoleCheck)) {
      // Check if authorization is properly enforced
      const hasProperCheck = /if\s*\(.*req\.user|userRole|isOwner|isAdmin/i.test(content);
      if (!hasProperCheck && hasPostPutPatchDelete) {
        addFinding(
          'MEDIUM',
          'Security - Potential Authorization Gap',
          file,
          'User data access may not be properly authorized',
          'Verify that ownership/role checks are enforced before data access',
          undefined
        );
      }
    }
  }
  
  // Check middleware consistency
  const middlewareFiles = await glob('server/src/middleware/**/*.ts');
  for (const file of middlewareFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check for proper error handling in middleware
    if (!/try\s*\{|catch|next\(/i.test(content) && /async|Promise/i.test(content)) {
      addFinding(
        'MEDIUM',
        'Security - Middleware Error Handling',
        file,
        'Middleware may not handle errors properly',
        'Add try-catch blocks and proper error responses in middleware',
        undefined
      );
    }
  }
}

// ============================================================================
// 2. VALIDATION MISMATCHES AUDIT
// ============================================================================

async function auditValidationMismatches() {
  console.log('✅ Auditing Validation Mismatches...\n');

  // Check backend validation schemas
  const routeFiles = await glob('server/src/routes/**/*.ts');
  const backendSchemas: Map<string, any> = new Map();
  
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Extract Zod schemas
    const schemaMatches = content.matchAll(/(\w+Schema)\s*=\s*z\.object\(/g);
    for (const match of schemaMatches) {
      const schemaName = match[1];
      const schemaStart = content.indexOf(match[0]);
      const schemaEnd = findMatchingBrace(content, schemaStart + match[0].length);
      const schemaCode = content.substring(schemaStart, schemaEnd + 1);
      
      backendSchemas.set(`${file}:${schemaName}`, {
        file,
        name: schemaName,
        code: schemaCode,
      });
    }
  }
  
  // Check frontend validation
  const frontendFiles = await glob('app/**/*.tsx');
  const frontendFiles2 = await glob('app/**/*.ts');
  
  for (const file of [...frontendFiles, ...frontendFiles2]) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check for hardcoded validation that might not match backend
    if (/minLength|maxLength|required|pattern/i.test(content)) {
      // Look for validation patterns that might be inconsistent
      const minLengthMatches = content.matchAll(/minLength:\s*(\d+)/g);
      const maxLengthMatches = content.matchAll(/maxLength:\s*(\d+)/g);
      
      // This is a simplified check - in reality, we'd need to map frontend to backend
      if (minLengthMatches || maxLengthMatches) {
        addFinding(
          'MEDIUM',
          'Validation - Potential Frontend/Backend Mismatch',
          file,
          'Frontend validation may not match backend schema',
          'Ensure frontend validation limits match backend Zod schemas',
          undefined
        );
      }
    }
  }
  
  // Check for missing validation on critical fields
  for (const [key, schema] of backendSchemas.entries()) {
    const schemaCode = schema.code;
    
    // Check for email validation
    if (schemaCode.includes('email') && !schemaCode.includes('z.string().email()')) {
      addFinding(
        'HIGH',
        'Validation - Missing Email Validation',
        schema.file,
        `Schema ${schema.name} has email field without proper validation`,
        'Add z.string().email() validation for email fields',
        undefined
      );
    }
    
    // Check for SQL injection prevention in string fields
    if (schemaCode.includes('z.string()') && !schemaCode.includes('.trim()')) {
      addFinding(
        'MEDIUM',
        'Validation - Missing Input Sanitization',
        schema.file,
        `Schema ${schema.name} may not sanitize string inputs`,
        'Consider adding .trim() to string validations to prevent whitespace issues',
        undefined
      );
    }
  }
}

// ============================================================================
// 3. ARCHITECTURAL INCONSISTENCIES AUDIT
// ============================================================================

async function auditArchitecturalInconsistencies() {
  console.log('🏗️  Auditing Architectural Inconsistencies...\n');

  const routeFiles = await glob('server/src/routes/**/*.ts');
  
  // Check for inconsistent error handling patterns
  const errorPatterns: Map<string, number> = new Map();
  
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Count different error response patterns
    if (/res\.status\((\d+)\)\.json\(\{.*error/i.test(content)) {
      const matches = content.matchAll(/res\.status\((\d+)\)\.json\(\{.*error/gi);
      for (const match of matches) {
        const status = match[1];
        errorPatterns.set(status, (errorPatterns.get(status) || 0) + 1);
      }
    }
    
    // Check for inconsistent response formats
    const hasErrorField = /error:\s*['"]/i.test(content);
    const hasMessageField = /message:\s*['"]/i.test(content);
    
    if (hasErrorField && !hasMessageField) {
      addFinding(
        'LOW',
        'Architecture - Inconsistent Error Response Format',
        file,
        'Error responses may not include both error and message fields',
        'Standardize error responses to include both error code and message',
        undefined
      );
    }
  }
  
  // Check for inconsistent middleware usage
  const middlewareUsage: Map<string, string[]> = new Map();
  
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const routerName = path.basename(file, '.ts');
    
    const usedMiddleware: string[] = [];
    if (/requireAuth/i.test(content)) usedMiddleware.push('requireAuth');
    if (/requireVerified/i.test(content)) usedMiddleware.push('requireVerified');
    if (/requireAdmin/i.test(content)) usedMiddleware.push('requireAdmin');
    if (/rateLimiter|limiter/i.test(content)) usedMiddleware.push('rateLimiter');
    
    middlewareUsage.set(routerName, usedMiddleware);
  }
  
  // Check for missing rate limiting on public endpoints
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    if (/post\s*\(['"]\/auth\//i.test(content) || /post\s*\(['"]\/users\/register/i.test(content)) {
      if (!/rateLimiter|limiter/i.test(content)) {
        addFinding(
          'HIGH',
          'Architecture - Missing Rate Limiting',
          file,
          'Authentication/registration endpoints may be missing rate limiting',
          'Add rate limiting middleware to prevent brute force attacks',
          undefined
        );
      }
    }
  }
  
  // Check for inconsistent database transaction usage
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check for multiple database writes without transactions
    const writeCount = (content.match(/\.create\(|\.update\(|\.delete\(/g) || []).length;
    const hasTransaction = /prisma\.\$transaction|transaction\(/i.test(content);
    
    if (writeCount > 1 && !hasTransaction) {
      addFinding(
        'MEDIUM',
        'Architecture - Missing Database Transactions',
        file,
        'Multiple database writes without transaction - potential data inconsistency',
        'Wrap multiple related database operations in a transaction',
        undefined
      );
    }
  }
  
  // Check for inconsistent logging
  const hasLogging = routeFiles.some(f => {
    const content = fs.readFileSync(f, 'utf-8');
    return /console\.(log|error|warn)|debugLog|logger/i.test(content);
  });
  
  if (!hasLogging) {
    addFinding(
      'LOW',
      'Architecture - Missing Logging',
      'server/src/routes',
      'Routes may not have consistent logging for debugging and monitoring',
      'Add structured logging for important operations and errors',
      undefined
    );
  }
}

// ============================================================================
// 4. PERMISSION & AUTHORIZATION AUDIT
// ============================================================================

async function auditPermissions() {
  console.log('🔐 Auditing Permissions & Authorization...\n');

  const routeFiles = await glob('server/src/routes/**/*.ts');
  
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    
    // Check for role-based access control
    if (/role|coach|fan|admin/i.test(content)) {
      // Check if role checks are properly enforced
      const hasRoleCheck = /userRole\s*===|role\s*===|prefs\.role/i.test(content);
      const hasProperEnforcement = /if\s*\(.*role|return\s+res\.status\(403\)/i.test(content);
      
      if (hasRoleCheck && !hasProperEnforcement) {
        addFinding(
          'HIGH',
          'Permissions - Incomplete Role Check',
          file,
          'Role check may not properly enforce access control',
          'Ensure role checks return 403 errors when access is denied',
          undefined
        );
      }
    }
    
    // Check for ownership verification
    if (/owner|creator|author_id/i.test(content)) {
      const hasOwnerCheck = /owner|creator|author_id.*===.*req\.user/i.test(content);
      
      if (!hasOwnerCheck && /update|delete|patch/i.test(content)) {
        addFinding(
          'CRITICAL',
          'Permissions - Missing Ownership Check',
          file,
          'Update/delete operations may not verify ownership',
          'Add ownership verification before allowing data modifications',
          undefined
        );
      }
    }
    
    // Check for subscription tier checks
    if (/plan|tier|subscription/i.test(content)) {
      const hasTierCheck = /userPlan|plan\s*===|tier\s*===/i.test(content);
      const hasLimitCheck = /limit|max|count/i.test(content);
      
      if (hasTierCheck && hasLimitCheck) {
        // Verify limit enforcement
        const hasEnforcement = /if\s*\(.*count.*>=|if\s*\(.*limit/i.test(content);
        if (!hasEnforcement) {
          addFinding(
            'MEDIUM',
            'Permissions - Subscription Limit Not Enforced',
            file,
            'Subscription tier limits may not be properly enforced',
            'Add explicit checks to enforce subscription tier limits',
            undefined
          );
        }
      }
    }
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function findMatchingBrace(content: string, startPos: number): number {
  let depth = 1;
  let pos = startPos;
  
  while (pos < content.length && depth > 0) {
    if (content[pos] === '{') depth++;
    if (content[pos] === '}') depth--;
    pos++;
  }
  
  return pos - 1;
}

// ============================================================================
// MAIN AUDIT RUNNER
// ============================================================================

async function runAudit() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     COMPREHENSIVE SYSTEM ARCHITECTURE AUDIT                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  await auditSecurityGaps();
  await auditValidationMismatches();
  await auditArchitecturalInconsistencies();
  await auditPermissions();
  
  // Generate Report
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    AUDIT SUMMARY                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const bySeverity = {
    CRITICAL: findings.filter(f => f.severity === 'CRITICAL'),
    HIGH: findings.filter(f => f.severity === 'HIGH'),
    MEDIUM: findings.filter(f => f.severity === 'MEDIUM'),
    LOW: findings.filter(f => f.severity === 'LOW'),
    INFO: findings.filter(f => f.severity === 'INFO'),
  };
  
  const byCategory: Record<string, AuditFinding[]> = {};
  findings.forEach(f => {
    if (!byCategory[f.category]) byCategory[f.category] = [];
    byCategory[f.category].push(f);
  });
  
  console.log(`Total Findings: ${findings.length}`);
  console.log(`  🔴 CRITICAL: ${bySeverity.CRITICAL.length}`);
  console.log(`  🟠 HIGH: ${bySeverity.HIGH.length}`);
  console.log(`  🟡 MEDIUM: ${bySeverity.MEDIUM.length}`);
  console.log(`  🔵 LOW: ${bySeverity.LOW.length}`);
  console.log(`  ℹ️  INFO: ${bySeverity.INFO.length}`);
  console.log('');
  
  // Print Critical and High findings
  if (bySeverity.CRITICAL.length > 0) {
    console.log('🔴 CRITICAL FINDINGS:');
    bySeverity.CRITICAL.forEach((f, i) => {
      console.log(`\n${i + 1}. ${f.issue}`);
      console.log(`   File: ${f.file}${f.line ? `:${f.line}` : ''}`);
      console.log(`   Category: ${f.category}`);
      console.log(`   Recommendation: ${f.recommendation}`);
      if (f.code) console.log(`   Code: ${f.code.substring(0, 100)}...`);
    });
    console.log('');
  }
  
  if (bySeverity.HIGH.length > 0) {
    console.log('🟠 HIGH PRIORITY FINDINGS:');
    bySeverity.HIGH.slice(0, 10).forEach((f, i) => {
      console.log(`\n${i + 1}. ${f.issue}`);
      console.log(`   File: ${f.file}${f.line ? `:${f.line}` : ''}`);
      console.log(`   Recommendation: ${f.recommendation}`);
    });
    console.log('');
  }
  
  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: findings.length,
      bySeverity,
      byCategory,
    },
    findings: findings.map(f => ({
      severity: f.severity,
      category: f.category,
      file: f.file,
      line: f.line,
      issue: f.issue,
      recommendation: f.recommendation,
    })),
  };
  
  fs.writeFileSync(
    'docs/SYSTEM_ARCHITECTURE_AUDIT_REPORT.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('📄 Detailed report saved to: docs/SYSTEM_ARCHITECTURE_AUDIT_REPORT.json');
  console.log('');
  
  // Exit with error code if critical findings
  process.exit(bySeverity.CRITICAL.length > 0 ? 1 : 0);
}

// Run audit
runAudit().catch((error) => {
  console.error('Fatal error running audit:', error);
  process.exit(1);
});
