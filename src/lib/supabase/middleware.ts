import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

/**
 * セッションを更新し、更新後のクッキーを応答へ書き戻す。
 *
 * Server Component はクッキーを書けないため、トークンの更新はここで行う。
 * これを通さないと、トークンの期限が切れた時点でログイン状態が失われる。
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // 認証クッキーを含む応答が CDN に載ると、他人のセッションが
          // 配られうる。ライブラリが渡すキャッシュ抑止ヘッダーを必ず付ける。
          for (const [key, headerValue] of Object.entries(headers)) {
            response.headers.set(key, headerValue);
          }
        },
      },
    },
  );

  // 応答が確定する前に呼ぶ必要がある。確定後にトークンが更新されると、
  // 更新後のクッキーを書き出せず、毎リクエストで更新が走る。
  await supabase.auth.getUser();

  return response;
}
