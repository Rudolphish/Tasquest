/**
 * データアクセス層。
 *
 * 画面から Supabase のクエリを直接組み立てず、必ず本層を経由する。
 * テーブル名や列名の変更が画面へ波及しないようにするため。
 */

export type { Db } from '@/lib/db/client';
export { ActiveSlotsFullError, XpAlreadyAwardedError } from '@/lib/db/errors';

export * as goals from '@/lib/db/goals';
export * as quests from '@/lib/db/quests';
export * as logs from '@/lib/db/logs';
export * as player from '@/lib/db/player';
