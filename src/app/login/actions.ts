'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export type SignInState = { status: 'idle' | 'sent' | 'error'; message?: string };

/**
 * マジックリンクを送る。
 *
 * パスワードを持たない。単独利用のサービスであり、パスワードの管理と
 * 再設定の経路を用意する利点が薄いため。
 */
export async function sendMagicLink(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    return { status: 'error', message: 'メールアドレスを入力してください。' };
  }

  const db = await createClient();
  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';

  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      // 招待していない相手が勝手に登録できないようにする。単独利用のため、
      // 最初の 1 人はダッシュボードから手で作る。
      shouldCreateUser: false,
    },
  });

  if (error) {
    // 送信の成否を伝える。ここで握りつぶすと、届かない原因が分からなくなる。
    return { status: 'error', message: `送信に失敗しました: ${error.message}` };
  }

  return { status: 'sent' };
}
