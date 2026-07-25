/**
 * How many SPORTS an organization runs.
 *
 * A sport is a `SportProgram`; its boys'/girls' and varsity/JV rosters are
 * sibling level teams inside that one program. Counting raw teams overstates
 * the org (three levels of one sport is one sport).
 *
 * Mirrors the server's `countBillableProgramsForContext`: distinct programs,
 * plus each ungrouped (null-program) team as its own unit — so the number a
 * coach sees on the org header agrees with the number they are billed for.
 */
export function countOrgSports(teams: { program_id?: string | null }[]): number {
  const programIds = new Set<string>();
  let ungrouped = 0;
  for (const team of teams ?? []) {
    const programId = team?.program_id ?? null;
    if (programId) programIds.add(programId);
    else ungrouped += 1;
  }
  return programIds.size + ungrouped;
}

export default countOrgSports;
