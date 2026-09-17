'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { quests as questsDb } from '@/lib/db';
import { optionalText, requiredText, todayIso, toMessage, type ActionState } from '@/lib/actions';
import type { Enums } from '@/lib/database.types';

const EFFORTS = ['S', 'M', 'L'] as const;

function parseEffort(value: FormDataEntryValue | null): Enums<'quest_effort'> {
  const found = EFFORTS.find((effort) => effort === value);
  if (!found) throw new Error('工数区分は S / M / L のいずれかを選んでください。');
  return found;
}

/**
 * クエストを手で作る。
 *
 * XP 値は渡さない。工数区分から生成列として導出されるため、渡そうとしても
 * 型検査とデータベースの双方が拒否する。
 */
export async function createQuestAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user, db } = await requireUser();

    await questsDb.createQuest(db, user.id, {
      goalId: requiredText(formData, 'goalId', '目標'),
      title: requiredText(formData, 'title', 'クエスト'),
      why: optionalText(formData, 'why'),
      effort: parseEffort(formData.get('effort')),
      dueOn: optionalText(formData, 'dueOn') ?? todayIso(),
    });

    revalidatePath('/today');
    revalidatePath(`/goals/${String(formData.get('goalId'))}`);
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: toMessage(error) };
  }
}

/** クエストを取り消す。 */
export async function deleteQuestAction(formData: FormData): Promise<void> {
  const { db } = await requireUser();
  await questsDb.deleteQuest(db, requiredText(formData, 'questId', 'クエスト'));
  revalidatePath('/today');
  revalidatePath(`/goals/${String(formData.get('goalId'))}`);
}
