'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Db } from '@/lib/db';
import type { Database } from '@/lib/database.types';

/** ブラウザ側の Supabase クライアント。 */
export function createClient(): Db {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
