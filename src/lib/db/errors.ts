/**
 * データアクセス層が投げる、呼び出し側が分岐しうる失敗。
 *
 * データベース側の制約に由来する失敗のうち、利用者に説明すべきものだけを
 * 独自の型に変換する。それ以外はそのまま送出する。
 */

/** PostgreSQL のエラーコード。参照する分のみ定義する。 */
const PG_UNIQUE_VIOLATION = '23505';
const PG_CHECK_VIOLATION = '23514';

/** アクティブ枠が埋まっている（D-1）。 */
export class ActiveSlotsFullError extends Error {
  constructor() {
    super('アクティブ枠が 3 件とも埋まっています。控えへ回すか、いずれかを完了してください。');
    this.name = 'ActiveSlotsFullError';
  }
}

/** 同一クエストに対する XP の二重加算。冪等な再試行では無視してよい。 */
export class XpAlreadyAwardedError extends Error {
  constructor() {
    super('このクエストの XP は加算済みです。');
    this.name = 'XpAlreadyAwardedError';
  }
}

type PostgrestLikeError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

function mentions(error: PostgrestLikeError, needle: string): boolean {
  return `${error.message ?? ''} ${error.details ?? ''}`.includes(needle);
}

/**
 * Supabase のエラーを、呼び出し側が扱える失敗に変換して送出する。
 *
 * 制約名で判定する。文言は PostgreSQL のバージョンで変わりうるため、
 * 制約名という安定した識別子を見る。
 */
export function throwMapped(error: PostgrestLikeError): never {
  if (error.code === PG_UNIQUE_VIOLATION && mentions(error, 'goals_active_slot_unique')) {
    throw new ActiveSlotsFullError();
  }
  if (error.code === PG_UNIQUE_VIOLATION && mentions(error, 'xp_events_quest_unique')) {
    throw new XpAlreadyAwardedError();
  }
  if (error.code === PG_CHECK_VIOLATION && mentions(error, 'goals_active_slot')) {
    throw new ActiveSlotsFullError();
  }

  const error_ = new Error(error.message ?? 'データベース操作に失敗しました');
  error_.cause = error;
  throw error_;
}
