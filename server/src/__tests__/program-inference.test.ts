import { describe, expect, it } from '@jest/globals';
import {
  inferLevelFromName,
  inferGenderFromName,
  inferProgramForTeam,
} from '../lib/programInference.js';

describe('program inference from legacy team names', () => {
  it('infers level', () => {
    expect(inferLevelFromName('Varsity Football')).toBe('varsity');
    expect(inferLevelFromName('JV Basketball')).toBe('jv');
    expect(inferLevelFromName('Junior Varsity Soccer')).toBe('jv');
    expect(inferLevelFromName('Freshman Tennis')).toBe('freshman');
    expect(inferLevelFromName('Frosh Baseball')).toBe('freshman');
    expect(inferLevelFromName('Unified Basketball')).toBe('unified');
    expect(inferLevelFromName('Middle School Track')).toBe('middle_school');
    expect(inferLevelFromName('Westhill Wolves')).toBe(null);
  });

  it('infers gender, defaulting coed', () => {
    expect(inferGenderFromName('Girls Varsity Soccer')).toBe('girls');
    expect(inferGenderFromName("Lady Knights Basketball")).toBe('girls');
    expect(inferGenderFromName("Women's Lacrosse")).toBe('girls');
    expect(inferGenderFromName('Boys JV Hockey')).toBe('boys');
    expect(inferGenderFromName("Men's Golf")).toBe('boys');
    expect(inferGenderFromName('Robotics Club')).toBe('coed');
  });

  it('combines name + sport column into a program key', () => {
    expect(
      inferProgramForTeam({ name: 'Girls JV Soccer', sport: 'Soccer' })
    ).toEqual({ sport: 'soccer', gender: 'girls', level: 'jv' });
    // sport column empty → fall back to finding a sport word in the name
    expect(
      inferProgramForTeam({ name: 'Varsity Football', sport: null })
    ).toEqual({ sport: 'football', gender: 'coed', level: 'varsity' });
    // unresolvable sport → null (reported by the script, never guessed)
    expect(inferProgramForTeam({ name: 'The Wolfpack', sport: 'idk' })).toBe(null);
  });

  it('two teams of different gender in the same sport share a program key', () => {
    // SportProgram is now keyed on (organization_id, sport) only — no gender
    // column. Gender lives on Team. inferProgramForTeam's return shape is
    // unchanged; the dedup happens at the caller (backfill-sport-programs.ts),
    // which upserts SportProgram on { organization_id, sport } and writes
    // gender onto each Team row individually. Boys/Girls Varsity Soccer must
    // therefore resolve to the same `sport` so they land on one program.
    const boys = inferProgramForTeam({ name: 'Boys Varsity Soccer', sport: 'Soccer' });
    const girls = inferProgramForTeam({ name: 'Girls Varsity Soccer', sport: 'Soccer' });
    expect(boys).toEqual({ sport: 'soccer', gender: 'boys', level: 'varsity' });
    expect(girls).toEqual({ sport: 'soccer', gender: 'girls', level: 'varsity' });
    expect(boys!.sport).toBe(girls!.sport);
    expect(boys!.gender).not.toBe(girls!.gender);
  });
});
