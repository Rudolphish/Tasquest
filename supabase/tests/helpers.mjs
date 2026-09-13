// PGlite 上に Supabase 相当の最小環境を用意し、マイグレーションを適用する。
//
// 検証にあたっての注意:
//   スーパーユーザーは RLS を迂回する。PGlite の既定接続はスーパーユーザーの
//   ため、そのままでは RLS を検証できない。本番と同じ authenticated ロールを
//   作成し、SET ROLE してから検証する。

import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MIGRATION = fileURLToPath(
  new URL('../migrations/0001_init.sql', import.meta.url),
);

export const USER_A = '11111111-1111-4111-8111-111111111111';
export const USER_B = '22222222-2222-4222-8222-222222222222';

/** Supabase の auth スキーマと、本番に存在するロールを最小限で再現する。 */
const BOOTSTRAP = `
  create schema if not exists auth;

  create table auth.users (
    id    uuid primary key,
    email text
  );

  -- 本番の auth.uid() 相当。セッション変数から現在のユーザーを読む。
  create or replace function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;

  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema auth to anon, authenticated;
  grant select on auth.users to authenticated;
`;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(BOOTSTRAP);
  await db.exec(await readFile(MIGRATION, 'utf8'));

  // 利用者 2 名を用意する。player 行はトリガーが作る。
  await db.exec(`
    insert into auth.users (id, email) values
      ('${USER_A}', 'a@example.test'),
      ('${USER_B}', 'b@example.test');
  `);

  return db;
}

/** 以降のクエリを、指定した利用者としてログイン中の authenticated ロールで実行する。 */
export async function actAs(db, userId) {
  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '${userId}', false);
    set role authenticated;
  `);
}

/** 管理者（スーパーユーザー）に戻す。RLS を迂回するため、準備処理にのみ用いる。 */
export async function actAsAdmin(db) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
}

/**
 * クエリが失敗することを確認し、その失敗内容を返す。
 * 成功してしまった場合は、その事実を明示して失敗させる。
 */
export async function expectRejected(db, sql, params) {
  try {
    await db.query(sql, params);
  } catch (error) {
    return error;
  }
  throw new Error(`拒否されるべきクエリが成功した: ${sql}`);
}

/** アクティブな目標を 1 件作る。 */
export async function insertActiveGoal(db, userId, title, slot) {
  return db.query(
    `insert into public.goals (user_id, title, status, active_slot, started_at)
     values ($1, $2, 'active', $3, now())
     returning id`,
    [userId, title, slot],
  );
}
