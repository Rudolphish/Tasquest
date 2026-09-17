import type { Db } from '@/lib/db/client';
import { ActiveSlotsFullError, throwMapped } from '@/lib/db/errors';
import type { Tables } from '@/lib/database.types';

export type Goal = Tables<'goals'>;
export type GoalPhase = Tables<'goal_phases'>;

/** アクティブ枠の番号。1..3 の 3 席しかない（D-1）。 */
export const ACTIVE_SLOTS = [1, 2, 3] as const;
export type ActiveSlot = (typeof ACTIVE_SLOTS)[number];

const GOAL_COLUMNS =
  'id, user_id, title, why, status, active_slot, share_with_external_ai, started_at, completed_at, created_at';

/** 目標を一覧する。アクティブを枠順、それ以外を作成順に並べる。 */
export async function listGoals(db: Db): Promise<Goal[]> {
  const { data, error } = await db
    .from('goals')
    .select(GOAL_COLUMNS)
    .order('active_slot', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throwMapped(error);
  return data ?? [];
}

/** 進行中の目標のみを枠順に取得する。 */
export async function listActiveGoals(db: Db): Promise<Goal[]> {
  const { data, error } = await db
    .from('goals')
    .select(GOAL_COLUMNS)
    .eq('status', 'active')
    .order('active_slot', { ascending: true });

  if (error) throwMapped(error);
  return data ?? [];
}

export async function getGoal(db: Db, goalId: string): Promise<Goal | null> {
  const { data, error } = await db
    .from('goals')
    .select(GOAL_COLUMNS)
    .eq('id', goalId)
    .maybeSingle();

  if (error) throwMapped(error);
  return data;
}

/** 目標の章を順に取得する。 */
export async function listPhases(db: Db, goalId: string): Promise<GoalPhase[]> {
  const { data, error } = await db
    .from('goal_phases')
    .select('*')
    .eq('goal_id', goalId)
    .order('phase_no', { ascending: true });

  if (error) throwMapped(error);
  return data ?? [];
}

/**
 * 目標を控えとして作る。
 *
 * 作成時点では枠を占有しない。進行させるかどうかは activate で別に決める。
 * 作成と枠の確保を分けることで、枠が埋まっている状況でも目標を書き留められる。
 */
export async function createGoal(
  db: Db,
  userId: string,
  input: { title: string; why?: string | null; shareWithExternalAi?: boolean },
): Promise<Goal> {
  const { data, error } = await db
    .from('goals')
    .insert({
      user_id: userId,
      title: input.title,
      why: input.why ?? null,
      share_with_external_ai: input.shareWithExternalAi ?? true,
      status: 'backlog',
    })
    .select(GOAL_COLUMNS)
    .single();

  if (error) throwMapped(error);
  return data;
}

/**
 * 控えの目標を進行中にする。空いている枠へ入れる。
 *
 * 空き枠の判定と確保の間に別の書き込みが入る可能性はあるが、
 * (user_id, active_slot) の部分一意索引が最終的な番人となるため、
 * 競合した場合は枠が埋まっていたものとして扱う。
 */
export async function activateGoal(db: Db, goalId: string): Promise<Goal> {
  const active = await listActiveGoals(db);
  const taken = new Set(active.map((goal) => goal.active_slot));
  const free = ACTIVE_SLOTS.find((slot) => !taken.has(slot));

  if (free === undefined) throw new ActiveSlotsFullError();

  const { data, error } = await db
    .from('goals')
    .update({ status: 'active', active_slot: free, started_at: new Date().toISOString() })
    .eq('id', goalId)
    .select(GOAL_COLUMNS)
    .single();

  if (error) throwMapped(error);
  return data;
}

/**
 * 目標を控えへ戻す、あるいは完了・中断として枠を空ける。
 *
 * status と active_slot の整合は CHECK 制約が保証するため、
 * 枠を必ず null にしてから状態を移す。
 */
export async function releaseGoal(
  db: Db,
  goalId: string,
  to: 'backlog' | 'done' | 'abandoned',
): Promise<Goal> {
  const { data, error } = await db
    .from('goals')
    .update({
      status: to,
      active_slot: null,
      completed_at: to === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', goalId)
    .select(GOAL_COLUMNS)
    .single();

  if (error) throwMapped(error);
  return data;
}

/** 外部 AI への送信可否を切り替える（D-6）。 */
export async function setShareWithExternalAi(
  db: Db,
  goalId: string,
  share: boolean,
): Promise<Goal> {
  const { data, error } = await db
    .from('goals')
    .update({ share_with_external_ai: share })
    .eq('id', goalId)
    .select(GOAL_COLUMNS)
    .single();

  if (error) throwMapped(error);
  return data;
}

/**
 * 指定した ID の目標をまとめて取得する。
 *
 * クエストに目標名を添えて表示する用途に使う。PostgREST の入れ子取得は
 * 複合外部キーの解決に不確実さがあるため、2 回に分けて取得し呼び出し側で
 * 突き合わせる。1 日あたりのクエストは 3 件であり、負荷は問題にならない。
 */
export async function listGoalsByIds(db: Db, ids: readonly string[]): Promise<Goal[]> {
  if (ids.length === 0) return [];

  const { data, error } = await db
    .from('goals')
    .select(GOAL_COLUMNS)
    .in('id', [...ids]);

  if (error) throwMapped(error);
  return data ?? [];
}
