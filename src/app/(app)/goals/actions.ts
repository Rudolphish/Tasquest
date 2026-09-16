'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { goals as goalsDb } from '@/lib/db';
import { optionalText, requiredText, toMessage, type ActionState } from '@/lib/actions';

/** 目標を控えとして作る。枠の確保は別の操作に分ける。 */
export async function createGoalAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user, db } = await requireUser();

    await goalsDb.createGoal(db, user.id, {
      title: requiredText(formData, 'title', '目標'),
      why: optionalText(formData, 'why'),
      shareWithExternalAi: formData.get('share') !== 'off',
    });

    revalidatePath('/goals');
    revalidatePath('/today');
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: toMessage(error) };
  }
}

/**
 * 控えの目標を進行中にする。
 *
 * 枠が埋まっている場合は失敗する。枠の上限はデータベースの制約が保証する
 * ため、ここでの判定を迂回しても 4 件目は成立しない。
 */
export async function activateGoalAction(formData: FormData): Promise<void> {
  const { db } = await requireUser();
  await goalsDb.activateGoal(db, requiredText(formData, 'goalId', '目標'));
  revalidatePath('/goals');
  revalidatePath('/today');
}

/** 目標を控えへ戻す、あるいは完了・中断として枠を空ける。 */
export async function releaseGoalAction(formData: FormData): Promise<void> {
  const { db } = await requireUser();
  const to = String(formData.get('to') ?? 'backlog');
  const target = to === 'done' || to === 'abandoned' ? to : 'backlog';

  await goalsDb.releaseGoal(db, requiredText(formData, 'goalId', '目標'), target);
  revalidatePath('/goals');
  revalidatePath('/today');
}
