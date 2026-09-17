/**
 * 日付の境界。
 *
 * 「今日」は利用者の生活時間で決まる。サーバーの時刻ではない。
 * Vercel の実行環境は UTC であるため、日本時間の朝に書いた記録が前日として
 * 保存されてしまう。連続記録は日付の境界に依存するため、ずれると成績が狂う。
 *
 * データベース側にも同じ定義を public.app_today() として置いている。
 * 両者が一致することを supabase/tests/clock.test.mjs で検査している。
 */

/** 生活時間の基準。単独利用のため固定とする。 */
export const APP_TIME_ZONE = 'Asia/Tokyo';

/** 指定時刻を、基準の時間帯における日付（YYYY-MM-DD）にする。 */
export function dateInAppZone(at: Date): string {
  // sv-SE ロケールは ISO と同じ YYYY-MM-DD を返す。
  return at.toLocaleDateString('sv-SE', { timeZone: APP_TIME_ZONE });
}

/** 今日の日付。データベースの date 列と同じ形。 */
export function todayIso(): string {
  return dateInAppZone(new Date());
}
