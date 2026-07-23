import { describe, expect, it } from '@jest/globals';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * ProTeam must stay unjoinable and unownable BY CONSTRUCTION.
 *
 * This is the load-bearing property of the pro-sports design, not a nice-to-
 * have: routing pro franchises through Team/Organization would have put a real
 * "become the owner of the Lakers" mechanism in the schema, with a boolean flag
 * as the only thing preventing it. "The foreign key does not exist" is an
 * argument that survives a trademark letter; "a flag blocks it" is one bad
 * merge away from being false.
 *
 * These tests fail if someone adds a membership relation, an owner column, or a
 * route that mutates a user↔ProTeam relation other than a follow.
 */

const SCHEMA = readFileSync(
  path.join(process.cwd(), 'prisma/schema.prisma'),
  'utf8'
);

function modelBlock(name: string): string {
  const match = SCHEMA.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, 'm'));
  if (!match) throw new Error(`model ${name} not found in schema.prisma`);
  return match[1];
}

describe('ProTeam is unjoinable by construction', () => {
  const block = modelBlock('ProTeam');

  it('has no membership or invite relation', () => {
    expect(block).not.toMatch(/Membership/);
    expect(block).not.toMatch(/Invite/);
    expect(block).not.toMatch(/JoinRequest/);
  });

  it('has no owner column', () => {
    expect(block).not.toMatch(/owner/i);
    expect(block).not.toMatch(/league_owner_id/);
    expect(block).not.toMatch(/created_by/);
  });

  it('has no approval or claim state, which would imply a claimable entity', () => {
    expect(block).not.toMatch(/admin_approved/);
    expect(block).not.toMatch(/approved_by/);
    expect(block).not.toMatch(/claim/i);
  });

  it('exposes exactly one user-facing relation, the follow', () => {
    const relations = [...block.matchAll(/^\s*\w+\s+(\w+)\[\]/gm)].map((m) => m[1]);
    // ProTeamFollow (users) plus the two Event back-relations (fixtures).
    expect(new Set(relations)).toEqual(new Set(['ProTeamFollow', 'Event']));
  });

  it('is not reachable from Team or Organization, so it inherits none of their machinery', () => {
    expect(modelBlock('Team')).not.toMatch(/ProTeam/);
    expect(modelBlock('Organization')).not.toMatch(/ProTeam/);
  });
});

describe('ProTeamFollow carries no role or status', () => {
  const block = modelBlock('ProTeamFollow');

  it('is a bare join row — following is the entire surface', () => {
    expect(block).not.toMatch(/role/i);
    expect(block).not.toMatch(/status/i);
    expect(block).not.toMatch(/approved/i);
  });
});

describe('no route grants a user any ProTeam relation but a follow', () => {
  const routesDir = path.join(process.cwd(), 'src/routes');
  const routeFiles = readdirSync(routesDir).filter((f) => f.endsWith('.ts'));

  it('only pro-teams.ts touches proTeam at all', () => {
    const touching = routeFiles.filter((f) =>
      /prisma\.proTeam(Follow)?\./.test(readFileSync(path.join(routesDir, f), 'utf8'))
    );
    expect(touching).toEqual(['pro-teams.ts']);
  });

  it('never creates, updates, or deletes a ProTeam from a route', () => {
    const source = readFileSync(path.join(routesDir, 'pro-teams.ts'), 'utf8');
    // Reads are fine; writes are not. ProTeam rows are seed/ingester-owned.
    expect(source).not.toMatch(/prisma\.proTeam\.(create|update|upsert|delete|createMany)/);
  });

  it('writes only proTeamFollow, and only upsert/deleteMany', () => {
    const source = readFileSync(path.join(routesDir, 'pro-teams.ts'), 'utf8');
    const writes = [...source.matchAll(/prisma\.proTeamFollow\.(\w+)/g)].map((m) => m[1]);
    const writeOps = writes.filter((op) => !['count', 'findUnique', 'findMany', 'findFirst'].includes(op));
    expect(new Set(writeOps)).toEqual(new Set(['upsert', 'deleteMany']));
  });
});

describe('pro pages disclaim affiliation', () => {
  it('serves a disclaimer naming the league on the team page', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/routes/pro-teams.ts'), 'utf8');
    expect(source).toMatch(/not affiliated with or endorsed by/i);
    expect(source).toMatch(/disclaimer/);
  });
});

describe('no team logos are stored', () => {
  it('ProTeam has no logo or image column', () => {
    const block = modelBlock('ProTeam');
    expect(block).not.toMatch(/logo/i);
    expect(block).not.toMatch(/avatar/i);
    expect(block).not.toMatch(/image/i);
  });
});
