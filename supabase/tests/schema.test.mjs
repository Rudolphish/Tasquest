// 0001_init.sql の検証。
//
// 制約は「記述したこと」ではなく「違反を拒否したこと」をもって検証する。

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  freshDb, actAs, actAsAdmin, expectRejected, insertActiveGoal,
  USER_A, USER_B,
} from './helpers.mjs';

test('マイグレーションが適用でき、player 行が自動生成される', async () => {
  const db = await freshDb();
  const { rows } = await db.query('select user_id from public.player order by user_id');
  assert.equal(rows.length, 2, '利用者 2 名ぶんの player 行が作られる');
  await db.close();
});

test('アクティブ枠は 3 件まで、4 件目は拒否される（D-1）', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  await insertActiveGoal(db, USER_A, 'Tasquest を公開する', 1);
  await insertActiveGoal(db, USER_A, '英語で技術発表する', 2);
  await insertActiveGoal(db, USER_A, '週 3 回走る', 3);

  const { rows } = await db.query(
    `select count(*)::int as n from public.goals where status = 'active'`);
  assert.equal(rows[0].n, 3, '3 件までは通る');

  // 枠 4 は CHECK 制約が拒否する
  const overflow = await expectRejected(db,
    `insert into public.goals (user_id, title, status, active_slot)
     values ($1, '簿記 2 級を取る', 'active', 4)`, [USER_A]);
  assert.match(String(overflow.message), /active_slot/);

  // 既存の枠との重複は部分一意索引が拒否する
  const duplicate = await expectRejected(db,
    `insert into public.goals (user_id, title, status, active_slot)
     values ($1, '簿記 2 級を取る', 'active', 2)`, [USER_A]);
  assert.match(String(duplicate.message), /goals_active_slot_unique/);

  await db.close();
});

test('アクティブなのに枠を持たない目標は拒否される', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  const error = await expectRejected(db,
    `insert into public.goals (user_id, title, status, active_slot)
     values ($1, '枠なしのアクティブ', 'active', null)`, [USER_A]);
  assert.match(String(error.message), /goals_active_slot_consistency/);

  await db.close();
});

test('控えの目標は枠を占有しないため、3 件を超えて持てる', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  await insertActiveGoal(db, USER_A, '目標 1', 1);
  await insertActiveGoal(db, USER_A, '目標 2', 2);
  await insertActiveGoal(db, USER_A, '目標 3', 3);
  for (const title of ['控え 1', '控え 2', '控え 3']) {
    await db.query(
      `insert into public.goals (user_id, title, status) values ($1, $2, 'backlog')`,
      [USER_A, title]);
  }

  const { rows } = await db.query(
    `select count(*)::int as n from public.goals where user_id = $1`, [USER_A]);
  assert.equal(rows[0].n, 6);

  await db.close();
});

test('他の利用者の行は見えず、他人名義での作成もできない（RLS）', async () => {
  const db = await freshDb();

  await actAs(db, USER_A);
  await insertActiveGoal(db, USER_A, 'A の目標', 1);

  await actAs(db, USER_B);
  await insertActiveGoal(db, USER_B, 'B の目標', 1);

  // B からは B の目標しか見えない
  const { rows } = await db.query('select title from public.goals');
  assert.deepEqual(rows.map((r) => r.title), ['B の目標']);

  // 他人名義の作成は WITH CHECK が拒否する
  const error = await expectRejected(db,
    `insert into public.goals (user_id, title, status, active_slot)
     values ($1, '成りすまし', 'active', 2)`, [USER_A]);
  assert.match(String(error.message), /row-level security/i);

  // 他人の行は更新対象にも入らない（0 行更新になる）
  const updated = await db.query(
    `update public.goals set title = '書き換え' where title = 'A の目標'`);
  assert.equal(updated.affectedRows, 0, '他人の行は更新されない');

  await db.close();
});

test('アクティブ枠は利用者ごとに独立している', async () => {
  const db = await freshDb();

  await actAs(db, USER_A);
  await insertActiveGoal(db, USER_A, 'A の枠 1', 1);

  // B も枠 1 を使える
  await actAs(db, USER_B);
  await insertActiveGoal(db, USER_B, 'B の枠 1', 1);

  const { rows } = await db.query(`select count(*)::int as n from public.goals`);
  assert.equal(rows[0].n, 1, 'B からは B の 1 件のみ見える');

  await db.close();
});

test('XP 値は工数区分から決まり、直接書き込めない（D-4）', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  const { rows: [goal] } = await insertActiveGoal(db, USER_A, '目標', 1);

  const { rows } = await db.query(
    `insert into public.quests (user_id, goal_id, title, effort, due_on)
     values ($1, $2, 'S のクエスト', 'S', current_date),
            ($1, $2, 'M のクエスト', 'M', current_date),
            ($1, $2, 'L のクエスト', 'L', current_date)
     returning effort, xp_value`,
    [USER_A, goal.id]);

  assert.deepEqual(
    Object.fromEntries(rows.map((r) => [r.effort, r.xp_value])),
    { S: 10, M: 25, L: 60 });

  // 生成列への直接の書き込みは PostgreSQL が拒否する
  const onInsert = await expectRejected(db,
    `insert into public.quests (user_id, goal_id, title, effort, due_on, xp_value)
     values ($1, $2, '不正なクエスト', 'S', current_date, 9999)`,
    [USER_A, goal.id]);
  assert.match(String(onInsert.message), /non-DEFAULT value into column "xp_value"/);

  const onUpdate = await expectRejected(db,
    `update public.quests set xp_value = 9999 where user_id = $1`, [USER_A]);
  assert.match(String(onUpdate.message), /column "xp_value" can only be updated to DEFAULT/);

  await db.close();
});

test('XP は減算できない（D-7）', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  const error = await expectRejected(db,
    `insert into public.xp_events (user_id, source, amount)
     values ($1, 'adjustment', -50)`, [USER_A]);
  assert.match(String(error.message), /xp_events_amount_check/);

  await db.close();
});

test('同一クエストに対する XP の二重加算は拒否される', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  const { rows: [goal] } = await insertActiveGoal(db, USER_A, '目標', 1);
  const { rows: [quest] } = await db.query(
    `insert into public.quests (user_id, goal_id, title, effort, due_on)
     values ($1, $2, 'クエスト', 'M', current_date) returning id`,
    [USER_A, goal.id]);

  await db.query(
    `insert into public.xp_events (user_id, source, quest_id, amount)
     values ($1, 'quest', $2, 25)`, [USER_A, quest.id]);

  const error = await expectRejected(db,
    `insert into public.xp_events (user_id, source, quest_id, amount)
     values ($1, 'quest', $2, 25)`, [USER_A, quest.id]);
  assert.match(String(error.message), /xp_events_quest_unique/);

  await db.close();
});

test('累計 XP とレベルは xp_events から導出され、RLS が効く', async () => {
  const db = await freshDb();

  await actAs(db, USER_A);
  await db.query(
    `insert into public.xp_events (user_id, source, amount)
     values ($1, 'quest', 1000), ($1, 'quest', 240)`, [USER_A]);

  const { rows } = await db.query('select * from public.player_progress');
  assert.equal(rows.length, 1, 'ビューにも RLS が適用される（security_invoker）');
  assert.equal(rows[0].total_xp, 1240);
  assert.equal(rows[0].level, 7);
  assert.ok(rows[0].next_level_xp > 1240, '次のレベルの必要 XP は現在値より大きい');

  // B からは A の XP が見えない
  await actAs(db, USER_B);
  const { rows: bRows } = await db.query('select total_xp from public.player_progress');
  assert.equal(bRows[0].total_xp, 0);

  await db.close();
});

test('レベル関数は xp_for_level と level_for_xp で整合する', async () => {
  const db = await freshDb();
  const { rows } = await db.query(`
    select lv,
           public.xp_for_level(lv) as need,
           public.level_for_xp(public.xp_for_level(lv))     as at_threshold,
           public.level_for_xp(public.xp_for_level(lv) - 1) as below_threshold
    from generate_series(2, 15) as lv
  `);
  for (const r of rows) {
    assert.equal(r.at_threshold, r.lv, `${r.need} XP でレベル ${r.lv} に到達する`);
    assert.equal(r.below_threshold, r.lv - 1, `1 XP 足りなければレベル ${r.lv - 1} のまま`);
  }
  await db.close();
});

test('章は目標の所有者と一致しない行を作れない', async () => {
  const db = await freshDb();

  await actAs(db, USER_A);
  const { rows: [goalA] } = await insertActiveGoal(db, USER_A, 'A の目標', 1);

  // B が A の目標 ID を知っていても、自分名義の章は作れない
  await actAs(db, USER_B);
  const error = await expectRejected(db,
    `insert into public.goal_phases (goal_id, user_id, phase_no, name)
     values ($1, $2, 1, '奪取した章')`, [goalA.id, USER_B]);
  assert.match(String(error.message), /foreign key|violates/i);

  await db.close();
});

test('章番号は目標ごとに一意で、1..4 に限られる（D-8）', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);
  const { rows: [goal] } = await insertActiveGoal(db, USER_A, '目標', 1);

  for (const [no, name] of [[1, '発音矯正期'], [2, '原稿作成期'], [3, '通し練習期'], [4, '本番調整期']]) {
    await db.query(
      `insert into public.goal_phases (goal_id, user_id, phase_no, name)
       values ($1, $2, $3, $4)`, [goal.id, USER_A, no, name]);
  }

  const fifth = await expectRejected(db,
    `insert into public.goal_phases (goal_id, user_id, phase_no, name)
     values ($1, $2, 5, '第 5 章')`, [goal.id, USER_A]);
  assert.match(String(fifth.message), /phase_no/);

  const duplicate = await expectRejected(db,
    `insert into public.goal_phases (goal_id, user_id, phase_no, name)
     values ($1, $2, 2, '重複した章')`, [goal.id, USER_A]);
  assert.match(String(duplicate.message), /goal_phases_goal_phase_key/);

  await db.close();
});

test('解決済みの振り返りは結論を伴う必要がある（D-7）', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  // 未処理はそのまま作れる
  await db.query(
    `insert into public.retrospectives (user_id, kind) values ($1, 'miss')`, [USER_A]);

  const error = await expectRejected(db,
    `insert into public.retrospectives (user_id, kind, status)
     values ($1, 'miss', 'resolved')`, [USER_A]);
  assert.match(String(error.message), /retrospectives_resolved_requires_insight/);

  await db.close();
});

test('失敗した AI 実行は理由を必須とし、再試行を妨げない（実装プラン S-4）', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  const noReason = await expectRejected(db,
    `insert into public.ai_runs (user_id, provider, model, purpose, status, target_on)
     values ($1, 'gemini', 'gemini-2.5-flash', 'daily_quests', 'failed', current_date)`,
    [USER_A]);
  assert.match(String(noReason.message), /ai_runs_failure_has_error/);

  // 同じ日に複数回失敗できる（失敗が「生成済み」を主張しない）
  for (let i = 0; i < 3; i += 1) {
    await db.query(
      `insert into public.ai_runs (user_id, provider, model, purpose, status, target_on, error)
       values ($1, 'gemini', 'gemini-2.5-flash', 'daily_quests', 'failed', current_date, '429')`,
      [USER_A]);
  }

  // 成功は 1 日 1 回に限られる
  await db.query(
    `insert into public.ai_runs (user_id, provider, model, purpose, status, target_on)
     values ($1, 'gemini', 'gemini-2.5-flash', 'daily_quests', 'succeeded', current_date)`,
    [USER_A]);

  const twice = await expectRejected(db,
    `insert into public.ai_runs (user_id, provider, model, purpose, status, target_on)
     values ($1, 'gemini', 'gemini-2.5-flash', 'daily_quests', 'succeeded', current_date)`,
    [USER_A]);
  assert.match(String(twice.message), /ai_runs_succeeded_unique/);

  await db.close();
});

test('AI 向け RPC は未実装であることを明示して失敗する（D-10）', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  for (const [sql, params] of [
    [`select * from public.propose_quests('{}'::jsonb)`, []],
    [`select * from public.propose_phases($1, '[]'::jsonb)`, [USER_A]],
    [`select * from public.record_insight($1, '結論')`, [USER_A]],
  ]) {
    const error = await expectRejected(db, sql, params);
    assert.match(String(error.message), /未実装/);
  }

  await db.close();
});

test('目標を削除すると、その章とクエストも消える', async () => {
  const db = await freshDb();
  await actAs(db, USER_A);

  const { rows: [goal] } = await insertActiveGoal(db, USER_A, '目標', 1);
  await db.query(
    `insert into public.goal_phases (goal_id, user_id, phase_no, name)
     values ($1, $2, 1, '第 1 章')`, [goal.id, USER_A]);
  await db.query(
    `insert into public.quests (user_id, goal_id, title, effort, due_on)
     values ($1, $2, 'クエスト', 'S', current_date)`, [USER_A, goal.id]);

  await db.query('delete from public.goals where id = $1', [goal.id]);

  for (const table of ['goal_phases', 'quests']) {
    const { rows } = await db.query(`select count(*)::int as n from public.${table}`);
    assert.equal(rows[0].n, 0, `${table} も削除される`);
  }

  await db.close();
});

test('未認証では 1 行も読めない', async () => {
  const db = await freshDb();

  await actAs(db, USER_A);
  await insertActiveGoal(db, USER_A, 'A の目標', 1);

  // ログインしていない authenticated ロール（auth.uid() が null）
  await db.exec(`
    reset role;
    select set_config('request.jwt.claim.sub', '', false);
    set role authenticated;
  `);

  const { rows } = await db.query('select * from public.goals');
  assert.equal(rows.length, 0);

  await actAsAdmin(db);
  await db.close();
});
