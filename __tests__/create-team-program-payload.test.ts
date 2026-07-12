/**
 * Unit tests for the pure helpers extracted from app/(tabs)/create-team.tsx
 * for Phase 2 Task 5 (create-team program + level pickers):
 *   - buildProgramFields: derives the program_id/level fields merged into
 *     the Team.create payload.
 *   - sportLabelToSlug: maps a sport picker label to its canonical taxonomy
 *     slug, returning null for 'Other'/custom sport labels.
 *
 * See docs/superpowers/specs/2026-07-09-sport-program-pivot-design.md.
 */
import { describe, expect, it } from '@jest/globals';
import { buildProgramFields, sportLabelToSlug } from '../app/(tabs)/create-team';
import { SPORT_OPTIONS } from '@/constants/sports';

describe('buildProgramFields', () => {
  it('returns {} when no program is selected or created and no level is chosen', () => {
    expect(
      buildProgramFields({ selectedProgramId: null, createdProgramId: null, level: null })
    ).toEqual({});
  });

  it('uses selectedProgramId when an existing program was chosen', () => {
    expect(
      buildProgramFields({
        selectedProgramId: 'program-123',
        createdProgramId: null,
        level: null,
      })
    ).toEqual({ program_id: 'program-123' });
  });

  it('falls back to createdProgramId when a new program was just created', () => {
    expect(
      buildProgramFields({
        selectedProgramId: null,
        createdProgramId: 'program-456',
        level: null,
      })
    ).toEqual({ program_id: 'program-456' });
  });

  it('includes level only when a level is chosen, with no program selected', () => {
    expect(
      buildProgramFields({ selectedProgramId: null, createdProgramId: null, level: 'varsity' })
    ).toEqual({ level: 'varsity' });
  });

  it('prefers selectedProgramId over createdProgramId when both are set', () => {
    expect(
      buildProgramFields({
        selectedProgramId: 'program-existing',
        createdProgramId: 'program-just-created',
        level: 'jv',
      })
    ).toEqual({ program_id: 'program-existing', level: 'jv' });
  });

  it('includes gender only when one is chosen', () => {
    expect(
      buildProgramFields({
        selectedProgramId: null,
        createdProgramId: null,
        level: null,
        gender: 'girls',
      })
    ).toEqual({ gender: 'girls' });
    expect(
      buildProgramFields({
        selectedProgramId: null,
        createdProgramId: null,
        level: null,
        gender: null,
      })
    ).toEqual({});
  });

  it('carries gender alongside program_id and level', () => {
    expect(
      buildProgramFields({
        selectedProgramId: 'program-123',
        createdProgramId: null,
        level: 'varsity',
        gender: 'boys',
      })
    ).toEqual({ program_id: 'program-123', level: 'varsity', gender: 'boys' });
  });
});

describe('sportLabelToSlug', () => {
  it('maps a canonical sport label to its taxonomy slug', () => {
    const [firstOption] = SPORT_OPTIONS;
    expect(sportLabelToSlug(firstOption.label)).toBe(firstOption.slug);
  });

  it('returns null for the "Other" custom-sport label', () => {
    expect(sportLabelToSlug('Other')).toBeNull();
  });

  it('returns null for an unrecognized/custom label', () => {
    expect(sportLabelToSlug('Definitely Not A Sport')).toBeNull();
  });

  it('returns null for an empty label', () => {
    expect(sportLabelToSlug('')).toBeNull();
  });
});
