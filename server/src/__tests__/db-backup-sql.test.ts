import { buildRowValuesClause, enumCastTypeName, type ColumnTypeInfo } from '../lib/dbBackupSql.js';

describe('dbBackupSql — enum-aware INSERT placeholder builder', () => {
  describe('enumCastTypeName', () => {
    it('returns the quoted enum type name for USER-DEFINED columns', () => {
      const col: ColumnTypeInfo = { dataType: 'USER-DEFINED', udtName: 'ApprovalStatus' };
      expect(enumCastTypeName(col)).toBe('"ApprovalStatus"');
    });

    it('returns "" for base scalar types (text, integer, boolean, timestamp)', () => {
      for (const dataType of [
        'text',
        'integer',
        'boolean',
        'timestamp without time zone',
        'jsonb',
      ]) {
        expect(enumCastTypeName({ dataType, udtName: 'whatever' })).toBe('');
      }
    });

    it('returns "" for arrays (current behavior — not a scalar enum)', () => {
      // enum arrays surface as data_type ARRAY with udt_name like _ApprovalStatus;
      // casting those as a scalar enum would be wrong, so they get no cast.
      expect(enumCastTypeName({ dataType: 'ARRAY', udtName: '_ApprovalStatus' })).toBe('');
    });

    it('returns "" when type info is missing (fallback path / schema drift)', () => {
      expect(enumCastTypeName(undefined)).toBe('');
    });
  });

  describe('buildRowValuesClause', () => {
    const noCast = () => '';

    it('emits bare $N placeholders when no column needs a cast', () => {
      const { clause, nextParamIdx } = buildRowValuesClause(['id', 'name', 'count'], 1, noCast);
      expect(clause).toBe('($1, $2, $3)');
      expect(nextParamIdx).toBe(4);
    });

    it('casts only the enum column, leaving others bare', () => {
      const castFor = (col: string) => (col === 'approval_status' ? '"ApprovalStatus"' : '');
      const { clause, nextParamIdx } = buildRowValuesClause(
        ['id', 'approval_status', 'created_at'],
        1,
        castFor
      );
      expect(clause).toBe('($1, $2::"ApprovalStatus", $3)');
      expect(nextParamIdx).toBe(4);
    });

    it('continues placeholder numbering from paramIdx (multi-row INSERTs)', () => {
      const castFor = (col: string) => (col === 'role' ? '"UserRole"' : '');
      // Simulate a second row in the same INSERT starting at $4.
      const { clause, nextParamIdx } = buildRowValuesClause(['id', 'role', 'email'], 4, castFor);
      expect(clause).toBe('($4, $5::"UserRole", $6)');
      expect(nextParamIdx).toBe(7);
    });

    it('chains across rows producing one contiguous parameter sequence', () => {
      const cols = ['id', 'status'];
      const castFor = (col: string) => (col === 'status' ? '"AdStatus"' : '');
      const row1 = buildRowValuesClause(cols, 1, castFor);
      const row2 = buildRowValuesClause(cols, row1.nextParamIdx, castFor);
      expect(row1.clause).toBe('($1, $2::"AdStatus")');
      expect(row2.clause).toBe('($3, $4::"AdStatus")');
      expect(row2.nextParamIdx).toBe(5);
    });
  });

  describe('regression: the Postgres 42804 enum-cast bug', () => {
    // The six enum-bearing tables that silently failed every backup run before
    // the fix. Each must produce an explicit ::"<EnumType>" cast on its enum
    // column so $executeRawUnsafe's text bind is coerced to the enum type.
    const enumColumns: Array<{ table: string; col: string; enumType: string }> = [
      { table: 'User', col: 'role', enumType: 'UserRole' },
      { table: 'Game', col: 'approval_status', enumType: 'ApprovalStatus' },
      { table: 'Event', col: 'status', enumType: 'EventStatus' },
      { table: 'Ad', col: 'status', enumType: 'AdStatus' },
      { table: 'TeamMembership', col: 'role', enumType: 'MembershipRole' },
      { table: 'Notification', col: 'type', enumType: 'NotificationType' },
    ];

    it.each(enumColumns)(
      '$table.$col is cast to ::"$enumType", never a bare placeholder',
      ({ col, enumType }) => {
        const typeMap = new Map<string, ColumnTypeInfo>([
          ['id', { dataType: 'text', udtName: 'text' }],
          [col, { dataType: 'USER-DEFINED', udtName: enumType }],
        ]);
        const castFor = (c: string) => enumCastTypeName(typeMap.get(c));
        const { clause } = buildRowValuesClause(['id', col], 1, castFor);
        expect(clause).toBe(`($1, $2::"${enumType}")`);
        expect(clause).not.toMatch(/\$2(?!::)/); // the enum placeholder is never left uncast
      }
    );
  });
});
