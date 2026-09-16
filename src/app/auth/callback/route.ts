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
 * メールのリンクの着地点。二通りの形式を受け付ける。
 *
 * 1. `?code=...`（PKCE）
 *    Supabase の既定のメール文面が使う形式。@supabase/ssr のクライアントは
 *    flowType を pkce に固定するため、既定のテンプレートのままこの形式で戻る。
 *    メールテンプレートの編集は不要であり、したがって独自 SMTP も不要。
 *
 * 2. `?token_hash=...&type=...`
 *    テンプレートを差し替えた場合の形式。独自 SMTP を設定してテンプレートを
 *    編集できるようにした場合に使う。現時点では使っていないが、
 *    切り替えてもこの経路がそのまま受けられるようにしてある。
 *
 * いずれの形式でも、検証に成功した場合のみ先へ進める。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  const db = await createClient();

  if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (error) redirect('/login?error=expired_link');
    redirect(safeNext(url.searchParams.get('next')));
  }

  if (tokenHash && type) {
    const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) redirect('/login?error=expired_link');
    redirect(safeNext(url.searchParams.get('next')));
  }

  redirect('/login?error=invalid_link');
}
