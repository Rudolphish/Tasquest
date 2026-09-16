'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { logs as logsDb } from '@/lib/db';
import { optionalText, requiredText, toMessage, type ActionState } from '@/lib/actions';

/** 記録を書く。目標に紐づけるかどうかは任意。 */
export async function createLogAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const { user, db } = await requireUser();

    await logsDb.createLog(db, user.id, {
      body: requiredText(formData, 'body', '記録'),
      goalId: optionalText(formData, 'goalId'),
    });

    revalidatePath('/log');
    revalidatePath('/today');
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', message: toMessage(error) };
  }
}
