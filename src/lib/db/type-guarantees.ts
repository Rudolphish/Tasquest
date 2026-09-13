/**
 * 型の上で保証されていることを、コンパイル時に検査する。
 *
 * 本ファイルは実行されない。@ts-expect-error は「この行は型エラーになる」
 * という表明であり、エラーが出なくなった時点で型検査が失敗する。
 * つまり保証が失われたら気づける。
 */

import type { TablesInsert, TablesUpdate } from '@/lib/database.types';

// --- D-4: XP 値は工数区分から導出され、書き込めない -------------------------

const insertQuest: TablesInsert<'quests'> = {
  user_id: '00000000-0000-4000-8000-000000000000',
  goal_id: '00000000-0000-4000-8000-000000000000',
  title: 'クエスト',
  effort: 'M',
  due_on: '2026-09-13',
};
void insertQuest;

const writeXpOnInsert: TablesInsert<'quests'> = {
  user_id: '00000000-0000-4000-8000-000000000000',
  goal_id: '00000000-0000-4000-8000-000000000000',
  title: 'クエスト',
  effort: 'M',
  due_on: '2026-09-13',
  // @ts-expect-error xp_value は生成列であり、挿入できない
  xp_value: 9999,
};
void writeXpOnInsert;

const writeXpOnUpdate: TablesUpdate<'quests'> = {
  // @ts-expect-error xp_value は生成列であり、更新できない
  xp_value: 9999,
};
void writeXpOnUpdate;

// --- 列挙型は定義された値しか取らない ---------------------------------------

const badEffort: TablesInsert<'quests'> = {
  user_id: '00000000-0000-4000-8000-000000000000',
  goal_id: '00000000-0000-4000-8000-000000000000',
  title: 'クエスト',
  // @ts-expect-error 工数区分は S / M / L のみ
  effort: 'XL',
  due_on: '2026-09-13',
};
void badEffort;

const badGoalStatus: TablesUpdate<'goals'> = {
  // @ts-expect-error 目標の状態は active / backlog / done / abandoned のみ
  status: 'paused',
};
void badGoalStatus;
