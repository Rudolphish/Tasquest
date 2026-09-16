import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

/**
 * 全リクエストの手前で走り、セッションを更新する。
 * Next.js 16 で middleware から proxy へ名称が変わった規約に従う。
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * 静的アセットと画像最適化を除く全経路。
     *
     * ここでの除外は「保護対象を絞る」ためのものではない。
     * 権限の判定は各ページとデータベースの RLS が行う。
     * 経路ごとの追加を忘れても穴が開かない形にしてある。
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
