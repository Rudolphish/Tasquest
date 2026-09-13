import type { Db } from '@/lib/db/client';
import { throwMapped } from '@/lib/db/errors';

/** 画面に出すプレイヤーの状態。ビューの nullable をここで解消する。 */
export type PlayerProgress = {
  totalXp: number;
  level: number;
  nextLevelXp: number;
  currentStreak: number;
  longestStreak: number;
  restTokens: number;
};

/**
 * 累計 XP とレベルを取得する。
 *
 * 値は xp_events の集計から導出される。player 表に累計値は存在しないため、
 * 台帳を経由しない加算は起こり得ない。
 */
export async function getProgress(db: Db): Promise<PlayerProgress> {
  const { data, error } = await db
    .from('player_progress')
    .select('total_xp, level, next_level_xp, current_streak, longest_streak, rest_tokens')
    .maybeSingle();

  if (error) throwMapped(error);
  if (!data) {
    throw new Error('プレイヤーの行が見つかりません。認証状態を確認してください。');
  }

  // ビューの列は PostgreSQL が非 null を証明できないため nullable になる。
  // 実際には集計結果であり null にはならないが、型の上では解消しておく。
  return {
    totalXp: data.total_xp ?? 0,
    level: data.level ?? 1,
    nextLevelXp: data.next_level_xp ?? 0,
    currentStreak: data.current_streak ?? 0,
    longestStreak: data.longest_streak ?? 0,
    restTokens: data.rest_tokens ?? 0,
  };
}
