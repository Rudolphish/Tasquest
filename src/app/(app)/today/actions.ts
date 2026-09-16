'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { quests as questsDb } from '@/lib/db';
import { requiredText } from '@/lib/actions';

/**
 * クエストを完了にする。
 *
 * この操作は XP を加算しない。状態の遷移と XP の加算を別々の書き込みで
 * 行うと、片方だけが成立した状態が生じうるためである。両者をまとめて
 * 単一のトランザクションで扱うデータベース関数を S5 で用意する。
 */
export async function completeQuestAction(formData: FormData): Promise<void> {
  const { db } = await requireUser();
  await questsDb.completeQuest(db, requiredText(formData, 'questId', 'クエスト'));
  revalidatePath('/today');
  revalidatePath('/goals');
}

/** 完了を取り消す。押し間違いを戻せるようにする。 */
export async function reopenQuestAction(formData: FormData): Promise<void> {
  const { db } = await requireUser();
  await questsDb.reopenQuest(db, requiredText(formData, 'questId', 'クエスト'));
  revalidatePath('/today');
  revalidatePath('/goals');
}
