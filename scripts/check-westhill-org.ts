#!/usr/bin/env tsx
/**
 * Debug script to check Westhill organization status
 * 
 * Usage:
 *   cd server && npx tsx ../scripts/check-westhill-org.ts
 * 
 * Or use raw SQL:
 *   cd server && npx prisma db execute --stdin <<'SQL'
 *   SELECT id, name, status, place_id, zip_code, created_at
 *   FROM "Organization"
 *   WHERE LOWER(name) LIKE '%westhill%';
 *   SQL
 */

import { PrismaClient } from '@prisma/client';
import '../server/src/lib/load-env.js';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Westhill Organization Diagnostic ===\n');

  // 1. Search for any organization with "westhill" in the name (case-insensitive)
  console.log('1. Searching for "westhill" (any status)...');
  const allWesthill = await prisma.organization.findMany({
    where: {
      name: { contains: 'westhill', mode: 'insensitive' },
    },
    select: {
      id: true,
      name: true,
      status: true,
      org_type: true,
      location: true,
      zip_code: true,
      place_id: true,
      created_at: true,
    },
  });

  if (allWesthill.length === 0) {
    console.log('   ❌ No "westhill" organizations found in database\n');
    
    // Search for similar names
    console.log('2. Searching for similar names (west*, *hill)...');
    const similar = await prisma.organization.findMany({
      where: {
        OR: [
          { name: { startsWith: 'West', mode: 'insensitive' } },
          { name: { endsWith: 'Hill', mode: 'insensitive' } },
          { name: { contains: 'West Hill', mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, status: true, location: true },
      take: 20,
    });
    
    if (similar.length === 0) {
      console.log('   ❌ No similar organizations found\n');
    } else {
      console.log(`   Found ${similar.length} similar organization(s):`);
      similar.forEach(org => {
        const statusIcon = org.status === 'active' ? '✅' : '❌';
        console.log(`   ${statusIcon} ${org.name} (${org.status}) - ${org.location || 'no location'}`);
      });
      console.log('');
    }
  } else {
    console.log(`   Found ${allWesthill.length} organization(s) with "westhill":\n`);
    allWesthill.forEach((org, idx) => {
      const statusIcon = org.status === 'active' ? '✅' : '❌';
      console.log(`   ${statusIcon} ${org.name}`);
      console.log(`      ID: ${org.id}`);
      console.log(`      Status: ${org.status}`);
      console.log(`      Type: ${org.org_type || 'not set'}`);
      console.log(`      Location: ${org.location || 'not set'}`);
      console.log(`      Zip: ${org.zip_code || 'not set'}`);
      console.log(`      Place ID: ${org.place_id || 'not set'}`);
      console.log(`      Created: ${org.created_at.toISOString()}`);
      console.log('');
    });
  }

  // 2. Test the exact search endpoint query (with status: 'active' filter)
  console.log('3. Testing search endpoint query (status=active + name contains "westhill")...');
  const searchResult = await prisma.organization.findMany({
    where: {
      status: 'active',
      OR: [
        { name: { contains: 'westhill', mode: 'insensitive' } },
        { description: { contains: 'westhill', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, status: true, location: true },
  });

  if (searchResult.length === 0) {
    console.log('   ❌ No active organizations match "westhill"');
    console.log('   → This is what the search endpoint returns\n');
  } else {
    console.log(`   ✅ Found ${searchResult.length} active organization(s):`);
    searchResult.forEach(org => {
      console.log(`      ${org.name} (${org.status}) - ${org.location || 'no location'}`);
    });
    console.log('');
  }

  // 3. Summary
  console.log('=== Summary ===');
  if (allWesthill.length === 0) {
    console.log('ISSUE: No "Westhill" organization exists in the database');
    console.log('SOLUTION: Create the organization or verify the exact name');
  } else if (searchResult.length === 0) {
    const inactive = allWesthill.filter(o => o.status !== 'active');
    if (inactive.length > 0) {
      console.log('ISSUE: "Westhill" exists but status is NOT "active"');
      console.log(`       Current status: ${inactive[0].status}`);
      console.log('SOLUTION: Update status to "active" in database:');
      console.log(`          UPDATE "Organization" SET status = 'active' WHERE id = '${inactive[0].id}';`);
    }
  } else {
    console.log('✅ "Westhill" organization exists and is active');
    console.log('   Search endpoint should return it');
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
