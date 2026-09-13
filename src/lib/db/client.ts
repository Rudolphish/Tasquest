import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/**
 * データアクセス層が受け取るクライアント。
 *
 * クライアントの生成方法（ブラウザ / サーバー / Route Handler）は呼び出し側の
 * 責務とし、ここでは受け取るだけにする。生成方法が増えても本層は変わらない。
 */
export type Db = SupabaseClient<Database>;
