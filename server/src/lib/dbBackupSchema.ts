import type { Prisma } from '@prisma/client';
import { BACKUP_EXCLUDED_TABLES } from './dbBackupTables.js';

type Reader = Pick<Prisma.TransactionClient, '$queryRawUnsafe'>;
export type BackupSchemaObject = { kind: string; object: string; name: string; definition: string };

// Compare PostgreSQL objects Prisma cannot represent too (partial/expression
// indexes, functions, policies and triggers). Exclude extension-owned routines.
export const BACKUP_SCHEMA_QUERY = `
SELECT 'column' kind,table_name object,column_name name,
  json_build_array(udt_schema,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale,datetime_precision,collation_name,is_identity,identity_generation,is_generated,generation_expression)::text definition
FROM information_schema.columns WHERE table_schema='public'
UNION ALL SELECT 'constraint',c.relname,k.conname,pg_get_constraintdef(k.oid)
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
UNION ALL SELECT 'index',tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'
UNION ALL SELECT 'rls',c.relname,'flags',c.relrowsecurity::text||'|'||c.relforcerowsecurity::text
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
UNION ALL SELECT 'policy',tablename,policyname,concat_ws('|',permissive,array_to_string(roles,','),cmd,qual,with_check)
FROM pg_policies WHERE schemaname='public'
UNION ALL SELECT 'trigger',c.relname,t.tgname,pg_get_triggerdef(t.oid)
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
UNION ALL SELECT 'function',p.proname,p.oid::regprocedure::text,pg_get_functiondef(p.oid)
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
UNION ALL SELECT 'enum',t.typname,'labels',string_agg(e.enumlabel,'|' ORDER BY e.enumsortorder)
FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname
UNION ALL SELECT 'extension',extname,'version',extversion FROM pg_extension
ORDER BY 1,2,3`;

export async function readBackupSchema(db: Reader): Promise<BackupSchemaObject[]> {
  const rows = await db.$queryRawUnsafe<BackupSchemaObject[]>(BACKUP_SCHEMA_QUERY);
  return rows.filter(row => !BACKUP_EXCLUDED_TABLES.has(row.object));
}

export function diffBackupSchema(primary: BackupSchemaObject[], backup: BackupSchemaObject[]) {
  const key = (row: BackupSchemaObject) => JSON.stringify([row.kind, row.object, row.name]);
  const expected = new Map(primary.map(row => [key(row), row]));
  const actual = new Map(backup.map(row => [key(row), row]));
  return {
    missingOrChanged: primary.filter(row => actual.get(key(row))?.definition !== row.definition),
    extra: backup.filter(row => !expected.has(key(row))),
  };
}

export async function assertBackupSchemaParity(primary: Reader, backup: Reader) {
  const [expected, actual] = await Promise.all([
    readBackupSchema(primary),
    readBackupSchema(backup),
  ]);
  const diff = diffBackupSchema(expected, actual);
  if (diff.missingOrChanged.length || diff.extra.length) {
    const keys = [...diff.missingOrChanged, ...diff.extra].map(
      row => `${row.kind}:${row.object}:${row.name}`
    );
    throw new Error(`Backup schema mismatch: ${keys.join(', ')}`);
  }
}
