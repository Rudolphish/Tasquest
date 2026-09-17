// goals.background と record_background の検証。

import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, actAs, expectRejected, insertActiveGoal, USER_A, USER_B } from './helpers.mjs';

async function goalWith(db, userId = USER_A) {
  await actAs(db, userId);
  const { rows: [goal] } = await insertActiveGoal(db, userId, '転職する', 1);
  return goal.id;
}

test('新しい目標の現在地は未記入で、書き手は人になっている', async () => {
  const db = await freshDb();
  const goalId = await goalWith(db);

  const { rows } = await db.query(
    `select background, background_updated_at, background_updated_by
       from public.goals where id = $1`, [goalId]);

  assert.equal(rows[0].background, null);
  assert.equal(rows[0].background_updated_at, null);
  assert.equal(rows[0].background_updated_by, 'user', '既定は人が書いたものとして扱う');

  await db.close();
});

test('内容が変わったときだけ更新時刻が刻まれる', async () => {
  const db = await freshDb();
  const goalId = await goalWith(db);

  await db.query(`update public.goals set background = '初稿' where id = $1`, [goalId]);
  const { rows: [first] } = await db.query(
    `select background_updated_at from public.goals where id = $1`, [goalId]);
  assert.ok(first.background_updated_at, '書いたら時刻が入る');

  // 内容を変えない更新では時刻が動かない
  await db.query(`update public.goals set title = '転職する（改）' where id = $1`, [goalId]);
  const { rows: [same] } = await db.query(
    `select background_updated_at from public.goals where id = $1`, [goalId]);
  assert.deepEqual(same.background_updated_at, first.background_updated_at);

  await db.close();
});

test('record_background が現在地を保存し、書き手を残す', async () => {
  const db = await freshDb();
  const goalId = await goalWith(db);

  const { rows } = await db.query(
    `select background, background_updated_by, background_updated_at
       from public.record_background($1, $2)`,
    [goalId, '  職務経歴書は 3 年前のまま。平日は夜のみ。  ']);

  assert.equal(rows[0].background, '職務経歴書は 3 年前のまま。平日は夜のみ。', '前後の空白は落とす');
  assert.equal(rows[0].background_updated_by, 'cowork');
  assert.ok(rows[0].background_updated_at);

  await db.close();
});

test('source を指定すると書き手として記録される', async () => {
  const db = await freshDb();
  const goalId = await goalWith(db);

  const { rows } = await db.query(
    `select background_updated_by from public.record_background($1, $2, 'gemini')`,
    [goalId, '自動でまとめた現在地']);

  assert.equal(rows[0].background_updated_by, 'gemini');

  await db.close();
});

test('上書きは許すが、書き手は入れ替わる', async () => {
  const db = await freshDb();
  const goalId = await goalWith(db);

  await db.query(`update public.goals set background = '人が書いた内容' where id = $1`, [goalId]);
  await db.query(`select public.record_background($1, $2)`, [goalId, 'AI がまとめ直した内容']);

  const { rows } = await db.query(
    `select background, background_updated_by from public.goals where id = $1`, [goalId]);

  assert.equal(rows[0].background, 'AI がまとめ直した内容');
  assert.equal(rows[0].background_updated_by, 'cowork', '誰が書いたかが残る');

  await db.close();
});

test('不正な入力は拒否される', async () => {
  const db = await freshDb();
  const goalId = await goalWith(db);

  const empty = await expectRejected(db,
    `select public.record_background($1, '   ')`, [goalId]);
  assert.match(String(empty.message), /background が空です/);

  const tooLong = await expectRejected(db,
    `select public.record_background($1, $2)`, [goalId, 'あ'.repeat(2001)]);
  assert.match(String(tooLong.message), /長すぎます/);

  const badSource = await expectRejected(db,
    `select public.record_background($1, '内容', 'openai')`, [goalId]);
  assert.match(String(badSource.message), /source は cowork か gemini/);

  // 直接の更新でも長さの上限は効く
  const viaUpdate = await expectRejected(db,
    `update public.goals set background = $2 where id = $1`, [goalId, 'あ'.repeat(2001)]);
  assert.match(String(viaUpdate.message), /goals_background_check/);

  await db.close();
});

test('他人の目標と、連携を切った目標には書けない', async () => {
  const db = await freshDb();

  await actAs(db, USER_B);
  const { rows: [goalB] } = await insertActiveGoal(db, USER_B, 'B の目標', 1);

  await actAs(db, USER_A);
  const others = await expectRejected(db,
    `select public.record_background($1, '他人の目標へ')`, [goalB.id]);
  assert.match(String(others.message), /目標が見つかりません/);

  const { rows: [opted] } = await db.query(
    `insert into public.goals (user_id, title, status, active_slot, share_with_external_ai)
     values ($1, '非公開の目標', 'active', 1, false) returning id`, [USER_A]);
  const optedOut = await expectRejected(db,
    `select public.record_background($1, '連携外へ')`, [opted.id]);
  assert.match(String(optedOut.message), /連携が無効/);

  await db.close();
});

test('控えの目標にも現在地は書ける', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  const { rows: [backlog] } = await db.query(
    `insert into public.goals (user_id, title, status) values ($1, '控えの目標', 'backlog')
     returning id`, [USER_A]);

  // 配備する前に現在地を整えられるようにする
  const { rows } = await db.query(
    `select background from public.record_background($1, $2)`,
    [backlog.id, '着手前の下調べは済んでいる']);

  assert.equal(rows[0].background, '着手前の下調べは済んでいる');

  await db.close();
});
