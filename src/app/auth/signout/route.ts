import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const db = await createClient();
  await db.auth.signOut();
  redirect('/login');
}
