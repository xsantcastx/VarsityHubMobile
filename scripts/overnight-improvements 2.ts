#!/usr/bin/env node
/**
 * Overnight Improvements Script
 * 
 * Automates critical improvements to strengthen the app:
 * 1. Security fixes (input validation, sanitization)
 * 2. Error handling improvements
 * 3. Performance optimizations
 * 4. Code quality enhancements
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

interface Improvement {
  type: 'security' | 'error-handling' | 'performance' | 'quality';
  file: string;
  issue: string;
  fix: string;
  status: 'pending' | 'fixed' | 'skipped';
}

const improvements: Improvement[] = [];

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║     OVERNIGHT IMPROVEMENTS - APP STRENGTHENING                 ║');
console.log('╚════════════════════════════════════════════════════════════════╝');
console.log('');

// ============================================================================
// 1. SECURITY IMPROVEMENTS
// ============================================================================

async function addInputSanitization() {
  console.log('🔒 Adding input sanitization...\n');
  
  const routeFiles = await glob('server/src/routes/**/*.ts');
  
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    let modified = false;
    const newLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find Zod string validations that don't have .trim()
      if (/z\.string\(\)\.(?!trim|email|url|uuid)/.test(line) && !line.includes('.trim()')) {
        // Check if it's part of a schema definition
        if (line.includes('z.string()') && !line.includes('.trim()') && !line.includes('.email()')) {
          const trimmed = line.replace(/z\.string\(\)/, 'z.string().trim()');
          newLines.push(trimmed);
          modified = true;
          
          improvements.push({
            type: 'security',
            file,
            issue: `Missing .trim() on string validation at line ${i + 1}`,
            fix: 'Added .trim() to sanitize input',
            status: 'fixed',
          });
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, newLines.join('\n'), 'utf-8');
      console.log(`✅ Fixed: ${file}`);
    }
  }
}

// ============================================================================
// 2. ERROR HANDLING IMPROVEMENTS
// ============================================================================

async function fixEmptyCatchBlocks() {
  console.log('\n🛡️  Fixing empty catch blocks...\n');
  
  const allFiles = [
    ...(await glob('app/**/*.{ts,tsx}')),
    ...(await glob('server/src/**/*.ts')),
  ];
  
  for (const file of allFiles) {
    // Skip node_modules, test files, and generated files
    if (file.includes('node_modules') || file.includes('.test.') || file.includes('.spec.')) {
      continue;
    }
    
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    let modified = false;
    const newLines: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Find empty catch blocks
      if (/catch\s*\{\s*\}/.test(line) || /catch\s*\(\s*\)\s*\{/.test(line) || /catch\s*\(\s*_\s*\)\s*\{/.test(line)) {
        // Check if next line is closing brace
        const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
        if (nextLine.trim() === '}') {
          const errorParam = line.includes('(') ? '(error: any)' : '(error: any)';
          const fixed = line.replace(/catch\s*[({]?[^})]*[})]?\s*\{/, `catch ${errorParam} {`);
          newLines.push(fixed);
          
          // Add error logging on next line
          newLines.push('    console.error(`[${path.basename(file)}] Error:`, error);');
          modified = true;
          
          improvements.push({
            type: 'error-handling',
            file,
            issue: `Empty catch block at line ${i + 1}`,
            fix: 'Added error parameter and logging',
            status: 'fixed',
          });
        } else {
          newLines.push(line);
        }
      } else {
        newLines.push(line);
      }
    }
    
    if (modified) {
      fs.writeFileSync(file, newLines.join('\n'), 'utf-8');
      console.log(`✅ Fixed: ${file}`);
    }
  }
}

// ============================================================================
// 3. PERFORMANCE IMPROVEMENTS
// ============================================================================

async function identifyPerformanceIssues() {
  console.log('\n⚡ Identifying performance issues...\n');
  
  const componentFiles = await glob('app/**/*.tsx');
  
  for (const file of componentFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check for FlatList without keyExtractor or getItemLayout
    if (content.includes('<FlatList') && !content.includes('keyExtractor')) {
      improvements.push({
        type: 'performance',
        file,
        issue: 'FlatList missing keyExtractor - can cause performance issues',
        fix: 'Add keyExtractor prop to FlatList',
        status: 'pending',
      });
    }
    
    // Check for components that could use React.memo
    if (content.includes('export default function') && !content.includes('React.memo')) {
      const componentName = content.match(/export default function\s+(\w+)/)?.[1];
      if (componentName && !componentName.includes('Screen') && !componentName.includes('Modal')) {
        improvements.push({
          type: 'performance',
          file,
          issue: `Component ${componentName} could benefit from React.memo`,
          fix: 'Wrap with React.memo to prevent unnecessary re-renders',
          status: 'pending',
        });
      }
    }
  }
  
  console.log(`📊 Found ${improvements.filter(i => i.type === 'performance').length} performance opportunities`);
}

// ============================================================================
// 4. CODE QUALITY IMPROVEMENTS
// ============================================================================

async function standardizeErrorResponses() {
  console.log('\n📝 Standardizing error responses...\n');
  
  const routeFiles = await glob('server/src/routes/**/*.ts');
  
  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check for inconsistent error response formats
    const hasErrorField = /res\.status\(\d+\)\.json\(\{.*error/i.test(content);
    const hasMessageField = /res\.status\(\d+\)\.json\(\{.*message/i.test(content);
    
    if (hasErrorField && !hasMessageField) {
      improvements.push({
        type: 'quality',
        file,
        issue: 'Error responses missing message field',
        fix: 'Standardize error responses to include both error and message',
        status: 'pending',
      });
    }
  }
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runImprovements() {
  try {
    // Run improvements (commented out auto-fixes for safety - uncomment after review)
    // await addInputSanitization();
    // await fixEmptyCatchBlocks();
    await identifyPerformanceIssues();
    await standardizeErrorResponses();
    
    // Generate report
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    IMPROVEMENTS SUMMARY                           ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    const byType = {
      security: improvements.filter(i => i.type === 'security'),
      'error-handling': improvements.filter(i => i.type === 'error-handling'),
      performance: improvements.filter(i => i.type === 'performance'),
      quality: improvements.filter(i => i.type === 'quality'),
    };
    
    console.log(`Total Improvements Identified: ${improvements.length}`);
    console.log(`  🔒 Security: ${byType.security.length}`);
    console.log(`  🛡️  Error Handling: ${byType['error-handling'].length}`);
    console.log(`  ⚡ Performance: ${byType.performance.length}`);
    console.log(`  📝 Quality: ${byType.quality.length}`);
    console.log('');
    
    if (improvements.length > 0) {
      console.log('Top 10 Improvements:');
      improvements.slice(0, 10).forEach((imp, i) => {
        console.log(`\n${i + 1}. [${imp.type.toUpperCase()}] ${imp.issue}`);
        console.log(`   File: ${imp.file}`);
        console.log(`   Fix: ${imp.fix}`);
      });
    }
    
    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: improvements.length,
        byType,
      },
      improvements: improvements.map(i => ({
        type: i.type,
        file: i.file,
        issue: i.issue,
        fix: i.fix,
        status: i.status,
      })),
    };
    
    fs.writeFileSync(
      'docs/OVERNIGHT_IMPROVEMENTS_REPORT.json',
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n📄 Detailed report saved to: docs/OVERNIGHT_IMPROVEMENTS_REPORT.json');
    console.log('');
    
  } catch (error) {
    console.error('Error running improvements:', error);
    process.exit(1);
  }
}

runImprovements();
