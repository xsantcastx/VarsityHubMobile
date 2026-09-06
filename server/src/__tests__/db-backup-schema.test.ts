import { diffBackupSchema, type BackupSchemaObject } from '../lib/dbBackupSchema.js';
const schema = (kind: string, definition: string): BackupSchemaObject[] => [
  { kind, object: 'User', name: 'boundary', definition },
];
describe('backup schema boundary', () => {
  it.each([
    'column',
    'constraint',
    'index',
    'rls',
    'policy',
    'trigger',
    'function',
    'enum',
    'extension',
  ])('rejects missing or changed %s definitions', kind => {
    const primary = schema(kind, 'correct');
    expect(diffBackupSchema(primary, []).missingOrChanged).toEqual(primary);
    expect(diffBackupSchema(primary, schema(kind, 'wrong')).missingOrChanged).toEqual(primary);
    expect(diffBackupSchema(primary, primary)).toEqual({ missingOrChanged: [], extra: [] });
  });
  it('rejects additional objects that could change restored writes', () => {
    const extra = schema('index', 'extra unique constraint');
    expect(diffBackupSchema([], extra).extra).toEqual(extra);
  });
});
