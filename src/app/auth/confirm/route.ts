import { redirect } from 'next/navigation';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

/**
 * 認証後の転送先として許す経路。
 *
 * 問い合わせ文字列の値をそのまま転送先にすると、任意の URL へ飛ばせる
 * 踏み台になる。受け取った値は既知の経路と突き合わせ、一致しなければ
 * 既定の経路へ落とす。
 */
const ALLOWED_NEXT = ['/today'] as const;
type AllowedNext = (typeof ALLOWED_NEXT)[number];

function safeNext(value: string | null): AllowedNext {
  return ALLOWED_NEXT.find((route) => route === value) ?? '/today';
}

/**
 * マジックリンクの着地点。
 *
 * Supabase の既定のメール文面は、トークンを URL のフラグメントに載せて返す。
 * フラグメントはサーバーへ送られないため、サーバー側でセッションを確立できない。
 * token_hash を問い合わせ文字列で受け取り、ここで検証する形にしている。
 * そのためにはメールのテンプレートを差し替える必要がある（docs/setup-supabase.md）。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  if (!tokenHash || !type) {
    redirect('/login?error=invalid_link');
  }

  const db = await createClient();
  const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });

  // 検証に失敗したまま先へ進めると、ログインしていないのに
  // ログイン後の画面へ遷移してしまう。成功した場合のみ進める。
  if (error) {
    redirect('/login?error=expired_link');
  }

  redirect(safeNext(url.searchParams.get('next')));
}
