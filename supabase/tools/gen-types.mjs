// マイグレーションから TypeScript の型定義を生成する。
//
// supabase gen types は CLI へのログインかデータベースパスワードを要求する。
// ここでは PGlite 上にマイグレーションを適用し、その内省結果から生成することで、
// 認証情報を持たない環境でも型を再生成できるようにしている。
// 出力形式は supabase gen types と互換であり、必要なら差し替えられる。

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { freshDb } from '../tests/helpers.mjs';

const OUT = fileURLToPath(new URL('../../src/lib/database.types.ts', import.meta.url));

/** PostgreSQL の型を TypeScript の型に対応付ける。 */
function tsTypeOf({ data_type, udt_name }, enumNames) {
  if (data_type === 'ARRAY') {
    const element = udt_name.replace(/^_/, '');
    return `${tsTypeOf({ data_type: '', udt_name: element }, enumNames)}[]`;
  }
  if (enumNames.has(udt_name)) {
    return `Database["public"]["Enums"]["${udt_name}"]`;
  }
  switch (udt_name) {
    case 'uuid': case 'text': case 'varchar': case 'date':
    case 'timestamptz': case 'timestamp': case 'time': case 'citext':
      return 'string';
    case 'int2': case 'int4': case 'int8': case 'float4': case 'float8': case 'numeric':
      return 'number';
    case 'bool':
      return 'boolean';
    case 'json': case 'jsonb':
      return 'Json';
    default:
      throw new Error(`未対応の型: ${udt_name}（対応表に追加すること）`);
  }
}

export async function generate() {
  const db = await freshDb();

  const { rows: enumRows } = await db.query(`
    select t.typname as name, e.enumlabel as label
    from pg_type t
    join pg_enum e on e.enumtypid = t.oid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder
  `);

  const enums = new Map();
  for (const { name, label } of enumRows) {
    if (!enums.has(name)) enums.set(name, []);
    enums.get(name).push(label);
  }
  const enumNames = new Set(enums.keys());

  const { rows: columnRows } = await db.query(`
    select
      c.table_name, c.column_name, c.ordinal_position,
      c.is_nullable, c.column_default, c.is_generated,
      c.data_type, c.udt_name,
      t.table_type
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public'
    order by c.table_name, c.ordinal_position
  `);

  // 入れ子の select を型で扱えるようにするため、外部キーを関係として出力する。
  const { rows: fkRows } = await db.query(`
    select
      con.conname                                as name,
      src.relname                                as table_name,
      tgt.relname                                as referenced_relation,
      (select array_agg(a.attname order by k.ord)
         from unnest(con.conkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum)
                                                 as columns,
      (select array_agg(a.attname order by k.ord)
         from unnest(con.confkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum)
                                                 as referenced_columns
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace n on n.oid = src.relnamespace
    where con.contype = 'f' and n.nspname = 'public'
    order by src.relname, con.conname
  `);

  const relationsByTable = new Map();
  for (const fk of fkRows) {
    if (!relationsByTable.has(fk.table_name)) relationsByTable.set(fk.table_name, []);
    relationsByTable.get(fk.table_name).push(fk);
  }

  const { rows: functionRows } = await db.query(`
    select p.proname as name
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('propose_quests', 'propose_phases', 'record_insight',
                        'xp_for_level', 'level_for_xp')
    order by p.proname
  `);

  const relations = new Map();
  for (const row of columnRows) {
    if (!relations.has(row.table_name)) {
      relations.set(row.table_name, { type: row.table_type, columns: [] });
    }
    relations.get(row.table_name).columns.push(row);
  }

  const tables = [];
  const views = [];
  for (const [name, rel] of [...relations].sort(([a], [b]) => a.localeCompare(b))) {
    (rel.type === 'VIEW' ? views : tables).push([name, rel.columns]);
  }

  const lines = [];
  lines.push('// このファイルは自動生成される。直接編集しないこと。');
  lines.push('// 再生成: npm run gen:types');
  lines.push('// 生成元: supabase/migrations/0001_init.sql');
  lines.push('');
  lines.push('export type Json =');
  lines.push('  | string');
  lines.push('  | number');
  lines.push('  | boolean');
  lines.push('  | null');
  lines.push('  | { [key: string]: Json | undefined }');
  lines.push('  | Json[];');
  lines.push('');
  lines.push('export type Database = {');
  lines.push('  public: {');

  // --- Tables -------------------------------------------------------------
  lines.push('    Tables: {');
  for (const [table, columns] of tables) {
    lines.push(`      ${table}: {`);

    lines.push('        Row: {');
    for (const col of columns) {
      const optional = col.is_nullable === 'YES' ? ' | null' : '';
      lines.push(`          ${col.column_name}: ${tsTypeOf(col, enumNames)}${optional};`);
    }
    lines.push('        };');

    // 生成列は書き込めないため Insert / Update から除外する。
    // これにより xp_value への代入が型検査の段階で落ちる。
    const writable = columns.filter((c) => c.is_generated !== 'ALWAYS');

    lines.push('        Insert: {');
    for (const col of writable) {
      const hasDefault = col.column_default !== null;
      const nullable = col.is_nullable === 'YES';
      const optional = hasDefault || nullable ? '?' : '';
      lines.push(
        `          ${col.column_name}${optional}: ${tsTypeOf(col, enumNames)}${nullable ? ' | null' : ''};`);
    }
    lines.push('        };');

    lines.push('        Update: {');
    for (const col of writable) {
      const nullable = col.is_nullable === 'YES';
      lines.push(
        `          ${col.column_name}?: ${tsTypeOf(col, enumNames)}${nullable ? ' | null' : ''};`);
    }
    lines.push('        };');

    const fks = relationsByTable.get(table) ?? [];
    if (fks.length === 0) {
      lines.push('        Relationships: [];');
    } else {
      lines.push('        Relationships: [');
      for (const fk of fks) {
        lines.push('          {');
        lines.push(`            foreignKeyName: "${fk.name}";`);
        lines.push(`            columns: [${fk.columns.map((c) => `"${c}"`).join(', ')}];`);
        lines.push('            isOneToOne: false;');
        lines.push(`            referencedRelation: "${fk.referenced_relation}";`);
        lines.push(
          `            referencedColumns: [${fk.referenced_columns.map((c) => `"${c}"`).join(', ')}];`);
        lines.push('          },');
      }
      lines.push('        ];');
    }

    lines.push('      };');
  }
  lines.push('    };');

  // --- Views --------------------------------------------------------------
  lines.push('    Views: {');
  for (const [view, columns] of views) {
    lines.push(`      ${view}: {`);
    lines.push('        Row: {');
    for (const col of columns) {
      const optional = col.is_nullable === 'YES' ? ' | null' : '';
      lines.push(`          ${col.column_name}: ${tsTypeOf(col, enumNames)}${optional};`);
    }
    lines.push('        };');
    lines.push('        Relationships: [];');
    lines.push('      };');
  }
  lines.push('    };');

  // --- Functions ----------------------------------------------------------
  lines.push('    Functions: {');
  for (const { name } of functionRows) {
    lines.push(`      ${name}: {`);
    lines.push('        Args: Record<string, unknown>;');
    lines.push('        Returns: unknown;');
    lines.push('      };');
  }
  lines.push('    };');

  // --- Enums --------------------------------------------------------------
  lines.push('    Enums: {');
  for (const [name, labels] of [...enums].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`      ${name}: ${labels.map((l) => `"${l}"`).join(' | ')};`);
  }
  lines.push('    };');

  lines.push('    CompositeTypes: Record<never, never>;');

  lines.push('  };');
  lines.push('};');
  lines.push('');
  lines.push('type PublicSchema = Database["public"];');
  lines.push('');
  lines.push('export type Tables<T extends keyof PublicSchema["Tables"]> =');
  lines.push('  PublicSchema["Tables"][T]["Row"];');
  lines.push('export type TablesInsert<T extends keyof PublicSchema["Tables"]> =');
  lines.push('  PublicSchema["Tables"][T]["Insert"];');
  lines.push('export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =');
  lines.push('  PublicSchema["Tables"][T]["Update"];');
  lines.push('export type Views<T extends keyof PublicSchema["Views"]> =');
  lines.push('  PublicSchema["Views"][T]["Row"];');
  lines.push('export type Enums<T extends keyof PublicSchema["Enums"]> =');
  lines.push('  PublicSchema["Enums"][T];');
  lines.push('');

  await db.close();
  return lines.join('\n');
}

// 直接実行されたときのみ書き出す（テストからは generate() を呼ぶ）。
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = await generate();
  await writeFile(OUT, source, 'utf8');
  console.log(`生成: ${OUT}（${source.split('\n').length} 行）`);
}
