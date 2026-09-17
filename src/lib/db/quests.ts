import type { Db } from '@/lib/db/client';
import { throwMapped } from '@/lib/db/errors';
import type { Enums, Tables } from '@/lib/database.types';

export type Quest = Tables<'quests'>;
export type Effort = Enums<'quest_effort'>;

const QUEST_COLUMNS =
  'id, user_id, goal_id, phase_id, title, why, effort, xp_value, status, due_on, generated_by, generated_at, completed_at, created_at';

/** その日のクエストを取得する。全目標を横断して 1 日 3 枚までとする（D-1）。 */
export async function listQuestsForDate(db: Db, isoDate: string): Promise<Quest[]> {
  const { data, error } = await db
    .from('quests')
    .select(QUEST_COLUMNS)
    .eq('due_on', isoDate)
    .order('created_at', { ascending: true });

  if (error) throwMapped(error);
  return data ?? [];
}

/** 目標に紐づくクエストを取得する。章で絞り込める。 */
export async function listQuestsForGoal(
  db: Db,
  goalId: string,
  options: { phaseId?: string } = {},
): Promise<Quest[]> {
  let query = db.from('quests').select(QUEST_COLUMNS).eq('goal_id', goalId);
  if (options.phaseId) query = query.eq('phase_id', options.phaseId);

  const { data, error } = await query.order('due_on', { ascending: false });

  if (error) throwMapped(error);
  return data ?? [];
}

/**
 * クエストを手元で作る。
 *
 * xp_value は渡さない。工数区分から生成列として導出されるため、
 * 渡そうとしても型検査とデータベースの双方が拒否する（D-4）。
 */
export async function createQuest(
  db: Db,
  userId: string,
  input: {
    goalId: string;
    phaseId?: string | null;
    title: string;
    why?: string | null;
    effort: Effort;
    dueOn: string;
  },
): Promise<Quest> {
  const { data, error } = await db
    .from('quests')
    .insert({
      user_id: userId,
      goal_id: input.goalId,
      phase_id: input.phaseId ?? null,
      title: input.title,
      why: input.why ?? null,
      effort: input.effort,
      due_on: input.dueOn,
      generated_by: 'manual',
    })
    .select(QUEST_COLUMNS)
    .single();

  if (error) throwMapped(error);
  return data;
}

/**
 * クエストを完了にする。
 *
 * この関数は XP を加算しない。状態の遷移と XP の加算を別々の書き込みで
 * 行うと、片方だけが成立した状態が生じうるためである。両者をまとめて
 * 単一のトランザクションで扱うデータベース関数を S5 で用意し、
 * 本関数はそれを呼ぶ形へ差し替える。
 */
export async function completeQuest(db: Db, questId: string): Promise<Quest> {
  const { data, error } = await db
    .from('quests')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', questId)
    .eq('status', 'open')
    .select(QUEST_COLUMNS)
    .single();

  if (error) throwMapped(error);
  return data;
}

/** 完了を取り消す。XP の扱いは S5 で完了処理と合わせて実装する。 */
export async function reopenQuest(db: Db, questId: string): Promise<Quest> {
  const { data, error } = await db
    .from('quests')
    .update({ status: 'open', completed_at: null })
    .eq('id', questId)
    .select(QUEST_COLUMNS)
    .single();

  if (error) throwMapped(error);
  return data;
}

/** クエストを取り消す。手で作ったものを消したいときに使う。 */
export async function deleteQuest(db: Db, questId: string): Promise<void> {
  const { error } = await db.from('quests').delete().eq('id', questId);
  if (error) throwMapped(error);
}
