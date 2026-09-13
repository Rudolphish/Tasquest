import type { Db } from '@/lib/db/client';
import { throwMapped } from '@/lib/db/errors';
import type { Tables } from '@/lib/database.types';

export type Log = Tables<'logs'>;

const LOG_COLUMNS = 'id, user_id, goal_id, quest_id, body, logged_on, created_at';

/** 記録を新しい順に取得する。 */
export async function listLogs(
  db: Db,
  options: { goalId?: string; limit?: number } = {},
): Promise<Log[]> {
  let query = db.from('logs').select(LOG_COLUMNS);
  if (options.goalId) query = query.eq('goal_id', options.goalId);

  const { data, error } = await query
    .order('logged_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 30);

  if (error) throwMapped(error);
  return data ?? [];
}

/**
 * 記録を書く。
 *
 * 目標に紐づかない記録も許す。その日の全体について書きたい場合があるため。
 */
export async function createLog(
  db: Db,
  userId: string,
  input: {
    body: string;
    goalId?: string | null;
    questId?: string | null;
    loggedOn?: string;
  },
): Promise<Log> {
  const { data, error } = await db
    .from('logs')
    .insert({
      user_id: userId,
      body: input.body,
      goal_id: input.goalId ?? null,
      quest_id: input.questId ?? null,
      ...(input.loggedOn ? { logged_on: input.loggedOn } : {}),
    })
    .select(LOG_COLUMNS)
    .single();

  if (error) throwMapped(error);
  return data;
}
