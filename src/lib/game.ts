/**
 * ゲーム側の数値。
 *
 * レベル曲線はデータベースの xp_for_level / level_for_xp と同じ定義を持つ。
 * 画面で「次のレベルまであとどれだけか」を描くには、現在のレベルの開始値が
 * 必要だが、ビューはそれを返さないため、こちらでも計算する。
 *
 * 二重定義になるため、両者が一致することを supabase/tests/game.test.mjs で
 * 検査している。片方だけ変えると検査が落ちる。
 */

/** 指定レベルに到達するために必要な累計 XP。 */
export function xpForLevel(level: number): number {
  const clamped = Math.max(Math.trunc(level), 1);
  return 30 * (clamped - 1) ** 2;
}

/** 累計 XP から現在のレベルを算出する。 */
export function levelForXp(totalXp: number): number {
  return Math.max(1, Math.floor(Math.sqrt(Math.max(totalXp, 0) / 30)) + 1);
}

/** 現在のレベルの中でどこまで進んだかを 0..1 で返す。 */
export function levelRatio(totalXp: number, level: number): number {
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (totalXp - start) / (end - start)));
}
