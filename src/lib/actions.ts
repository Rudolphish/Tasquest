import { ActiveSlotsFullError } from '@/lib/db';

export { todayIso } from '@/lib/clock';

/** フォームに結果を返すための共通の形。 */
export type ActionState = { status: 'idle' | 'ok'; message?: undefined } | { status: 'error'; message: string };

export const IDLE: ActionState = { status: 'idle' };

/**
 * 失敗を、利用者に見せる文言へ変換する。
 *
 * 想定済みの失敗だけを文言にし、それ以外は元の内容をそのまま見せる。
 * 握りつぶすと、原因が分からないまま同じ操作を繰り返すことになる。
 */
export function toMessage(error: unknown): string {
  if (error instanceof ActiveSlotsFullError) return error.message;
  if (error instanceof Error) return error.message;
  return '処理に失敗しました。';
}

/** 必須の文字列をフォームから取り出す。 */
export function requiredText(formData: FormData, key: string, label: string): string {
  const value = String(formData.get(key) ?? '').trim();
  if (!value) throw new Error(`${label}を入力してください。`);
  return value;
}

/** 任意の文字列をフォームから取り出す。空なら null。 */
export function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? '').trim();
  return value === '' ? null : value;
}
