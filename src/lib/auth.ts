import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { Db } from '@/lib/db';

/**
 * ログイン済みであることを要求し、利用者とクライアントを返す。
 *
 * getSession ではなく getUser を使う。getSession はクッキーの内容を
 * そのまま返すため、サーバー側で信頼してはいけない。
 */
export async function requireUser(): Promise<{ user: User; db: Db }> {
  const db = await createClient();
  const { data, error } = await db.auth.getUser();

  if (error || !data.user) redirect('/login');

  return { user: data.user, db };
}

/** ログインしていれば利用者を、していなければ null を返す。 */
export async function currentUser(): Promise<User | null> {
  const db = await createClient();
  const { data } = await db.auth.getUser();
  return data.user ?? null;
}
