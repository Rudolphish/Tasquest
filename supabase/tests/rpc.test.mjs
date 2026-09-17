// propose_quests の検証。
//
// AI からの書き込み経路であるため、受け付けてはいけないものを確実に
// 拒否することを中心に確認する。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshDb, actAs, expectRejected, insertActiveGoal, USER_A, USER_B,
} from './helpers.mjs';

/** 目標を 1 件だけ持つ状態を作る。 */
async function withActiveGoal(db, userId = USER_A) {
  await actAs(db, userId);
  const { rows: [goal] } = await insertActiveGoal(db, userId, '英語で技術発表する', 1);
  return goal.id;
}

const quest = (goalId, title, effort = 'M') => ({ goal_id: goalId, title, effort });

test('提案されたクエストが登録され、XP は工数区分から決まる', async () => {
  const db = await freshDb();
  const goalId = await withActiveGoal(db);

  const { rows } = await db.query(
    `select title, effort, xp_value, generated_by, due_on, status
       from public.propose_quests($1::jsonb)`,
    [JSON.stringify([
      { goal_id: goalId, title: '導入 30 秒を音読して録音する', why: '型が抜けるため', effort: 'S' },
      quest(goalId, '本編 3 分ぶんを書く', 'M'),
      quest(goalId, '通しで一度録る', 'L'),
    ])],
  );

  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => [r.effort, r.xp_value]).sort(),
    [['L', 60], ['M', 25], ['S', 10]],
  );
  assert.ok(rows.every((r) => r.generated_by === 'cowork'), '生成元が記録される');
  assert.ok(rows.every((r) => r.status === 'open'));

  await db.close();
});

test('1 日 3 枚の上限を全目標横断で強制する（D-1）', async () => {
  const db = await freshDb();
  const goalA = await withActiveGoal(db);
  const { rows: [goalB] } = await insertActiveGoal(db, USER_A, '週 3 回走る', 2);

  // 4 枚を一度に渡すと拒否される
  const atOnce = await expectRejected(db,
    `select * from public.propose_quests($1::jsonb)`,
    [JSON.stringify([
      quest(goalA, '1 枚目'), quest(goalA, '2 枚目'),
      quest(goalB.id, '3 枚目'), quest(goalB.id, '4 枚目'),
    ])]);
  assert.match(String(atOnce.message), /1 日あたり 3 枚まで/);

  // 2 枚置いたあと、さらに 2 枚を足そうとしても拒否される
  await db.query(`select * from public.propose_quests($1::jsonb)`,
    [JSON.stringify([quest(goalA, '1 枚目'), quest(goalB.id, '2 枚目')])]);

  const later = await expectRejected(db,
    `select * from public.propose_quests($1::jsonb)`,
    [JSON.stringify([quest(goalA, '3 枚目'), quest(goalA, '4 枚目')])]);
  assert.match(String(later.message), /既存 2 枚、追加 2 枚/);

  // 3 枚目の 1 枚だけなら通る
  const { rows } = await db.query(
    `select title from public.propose_quests($1::jsonb)`,
    [JSON.stringify([quest(goalA, '3 枚目')])]);
  assert.equal(rows.length, 1);

  await db.close();
});

test('上限は日ごとに数える', async () => {
  const db = await freshDb();
  const goalId = await withActiveGoal(db);

  // date 列は Date として返るため、文字列として受け取る。
  const { rows: [{ next_day: nextDay }] } = await db.query(
    `select (public.app_today() + 1)::text as next_day`);

  await db.query(`select * from public.propose_quests($1::jsonb)`,
    [JSON.stringify([
      quest(goalId, '本日 1'), quest(goalId, '本日 2'), quest(goalId, '本日 3'),
    ])]);

  // 翌日ぶんはまだ 0 枚なので通る
  const { rows } = await db.query(
    `select due_on from public.propose_quests($1::jsonb)`,
    [JSON.stringify([
      { goal_id: goalId, title: '翌日 1', effort: 'S', due_on: nextDay },
      { goal_id: goalId, title: '翌日 2', effort: 'S', due_on: nextDay },
    ])]);
  assert.equal(rows.length, 2);

  await db.close();
});

test('XP 値を渡しても無視される（D-4）', async () => {
  const db = await freshDb();
  const goalId = await withActiveGoal(db);

  const { rows } = await db.query(
    `select xp_value from public.propose_quests($1::jsonb)`,
    [JSON.stringify([{ goal_id: goalId, title: '値を詐称する', effort: 'S', xp_value: 9999 }])]);

  assert.equal(rows[0].xp_value, 10, '渡された値ではなく工数区分から決まる');

  await db.close();
});

test('他人の目標、進行中でない目標、連携を切った目標は拒否される', async () => {
  const db = await freshDb();

  // B の目標
  await actAs(db, USER_B);
  const { rows: [goalB] } = await insertActiveGoal(db, USER_B, 'B の目標', 1);

  await actAs(db, USER_A);
  const others = await expectRejected(db,
    `select * from public.propose_quests($1::jsonb)`,
    [JSON.stringify([quest(goalB.id, '他人の目標へ')])]);
  assert.match(String(others.message), /目標が見つかりません/);

  // 控えの目標
  const { rows: [backlog] } = await db.query(
    `insert into public.goals (user_id, title, status) values ($1, '控え', 'backlog') returning id`,
    [USER_A]);
  const notActive = await expectRejected(db,
    `select * from public.propose_quests($1::jsonb)`,
    [JSON.stringify([quest(backlog.id, '控えへ')])]);
  assert.match(String(notActive.message), /進行中でない目標/);

  // 連携を切った目標
  const { rows: [opted] } = await db.query(
    `insert into public.goals (user_id, title, status, active_slot, share_with_external_ai)
     values ($1, '非公開の目標', 'active', 1, false) returning id`,
    [USER_A]);
  const optedOut = await expectRejected(db,
    `select * from public.propose_quests($1::jsonb)`,
    [JSON.stringify([quest(opted.id, '連携外へ')])]);
  assert.match(String(optedOut.message), /連携が無効/);

  await db.close();
});

test('不正な入力は個別に拒否される', async () => {
  const db = await freshDb();
  const goalId = await withActiveGoal(db);

  const cases = [
    [[{ goal_id: goalId, title: 'XL は無い', effort: 'XL' }], /effort は S \/ M \/ L/],
    [[{ goal_id: goalId, title: '   ', effort: 'S' }], /title は必須/],
    [[{ goal_id: goalId, title: 'あ'.repeat(161), effort: 'S' }], /title が長すぎます/],
    [[{ goal_id: 'not-a-uuid', title: '壊れた ID', effort: 'S' }], /goal_id が UUID ではありません/],
    [[{ title: 'ID なし', effort: 'S' }], /goal_id は必須/],
    [[{ goal_id: goalId, title: '過去の日付', effort: 'S', due_on: '2020-01-01' }], /過去の日付/],
    [[], /1 件も含まれていません/],
    ['文字列', /配列、または quests を持つ/],
    [{ quests: '配列ではない' }, /quests に配列を渡してください/],
    [{ quests: [], source: 'openai' }, /source は cowork か gemini/],
  ];

  for (const [payload, pattern] of cases) {
    const error = await expectRejected(db,
      `select * from public.propose_quests($1::jsonb)`, [JSON.stringify(payload)]);
    assert.match(String(error.message), pattern, `入力: ${JSON.stringify(payload).slice(0, 60)}`);
  }

  // 1 件でも不正なら、まとめて何も登録されない
  const { rows } = await db.query(`select count(*)::int as n from public.quests`);
  assert.equal(rows[0].n, 0, '検証に失敗した提案は 1 件も登録されない');

  await db.close();
});

test('source を指定すると生成元として記録される', async () => {
  const db = await freshDb();
  const goalId = await withActiveGoal(db);

  const { rows } = await db.query(
    `select generated_by from public.propose_quests($1::jsonb)`,
    [JSON.stringify({ source: 'gemini', quests: [quest(goalId, '自動生成')] })]);

  assert.equal(rows[0].generated_by, 'gemini');

  await db.close();
});

test('ログインしていなければ拒否される', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);
  const goalId = await withActiveGoal(db);

  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '', false);
    set role authenticated;
  `);

  const error = await expectRejected(db,
    `select * from public.propose_quests($1::jsonb)`,
    [JSON.stringify([quest(goalId, '未ログイン')])]);
  assert.match(String(error.message), /ログインしていません|目標が見つかりません/);

  await db.close();
});
