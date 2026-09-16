import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Db } from '@/lib/db';
import type { Database } from '@/lib/database.types';

/**
 * サーバー側（Server Component / Server Action / Route Handler）の
 * Supabase クライアントを作る。
 *
 * リクエストごとに新しく作る。使い回すと、2 回目以降の応答に
 * 認証クッキーのキャッシュ抑止ヘッダーが付かなくなる。
 */
export async function createClient(): Promise<Db> {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component からはクッキーを書けない。
            // セッションの更新は middleware が担うため、ここでは無視してよい。
          }
        },
      },
    },
  );
}
