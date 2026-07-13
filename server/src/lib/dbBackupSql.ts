/**
 * Pure SQL fragment builders for the DB backup sync's bulk INSERTs.
 *
 * Extracted from dbBackupSync.ts so the enum-cast logic — the source of the
 * Postgres `42804` "column is of type X but expression is of type text"
 * failure — is unit-testable without a database connection.
 */

export type ColumnTypeInfo = { dataType: string; udtName: string };

/**
 * Returns the quoted enum type name to cast a column's bind parameter to, or
 * '' for columns that need no cast.
 *
 * Postgres exposes enum columns via information_schema as
 * `data_type = 'USER-DEFINED'` with `udt_name` = the enum type name.
 * `$executeRawUnsafe` binds parameters as text and Postgres will NOT implicitly
 * coerce text -> enum, so enum columns require an explicit `$N::"Type"` cast
 * (error 42804 otherwise). Base types, arrays, and unknown columns get no cast
 * — preserving the prior behavior for everything that already worked.
 */
export function enumCastTypeName(colType: ColumnTypeInfo | undefined): string {
  return colType && colType.dataType === 'USER-DEFINED' ? `"${colType.udtName}"` : '';
}

/**
 * Builds a single VALUES row clause — e.g. `($1, $2::"ApprovalStatus", $3)` —
 * for `columns`, numbering placeholders from `paramIdx`. `castFor` returns the
 * quoted enum type name for a column (from {@link enumCastTypeName}) or '' for
 * no cast. Returns the clause plus the next free parameter index so callers can
 * chain rows in one multi-row INSERT.
 */
export function buildRowValuesClause(
  columns: string[],
  paramIdx: number,
  castFor: (col: string) => string
): { clause: string; nextParamIdx: number } {
  const placeholders = columns.map(col => {
    const ph = `$${paramIdx++}`;
    const cast = castFor(col);
    return cast ? `${ph}::${cast}` : ph;
  });
  return { clause: `(${placeholders.join(', ')})`, nextParamIdx: paramIdx };
}
