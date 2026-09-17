'use client';

import { useActionState } from 'react';
import { IDLE, type ActionState } from '@/lib/actions';
import { createQuestAction } from './actions';

/** 工数区分ごとの XP。表示のみに使う。実際の値はデータベースが決める。 */
const COST_HINT = { S: 10, M: 25, L: 60 } as const;

export function NewQuestForm({ goalId, today }: { goalId: string; today: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createQuestAction, IDLE);

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <input type="hidden" name="goalId" value={goalId} />

      <label className="field">
        <span>クエスト</span>
        <input name="title" required maxLength={160} placeholder="発表原稿の導入 30 秒を音読して録音する" />
      </label>

      <label className="field">
        <span>なぜ今日これをやるのか（任意）</span>
        <input name="why" maxLength={500} placeholder="原稿作成期のクエスト 4 件目" />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="field">
          <span>工数</span>
          <select name="effort" defaultValue="M">
            {(['S', 'M', 'L'] as const).map((effort) => (
              <option key={effort} value={effort}>
                {effort}　+{COST_HINT[effort]} EXP
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>いつやるか</span>
          <input type="date" name="dueOn" defaultValue={today} />
        </label>
      </div>

      {state.status === 'error' && <p className="error">{state.message}</p>}
      {state.status === 'ok' && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--green)' }}>クエストを置きました。</p>
      )}

      <button type="submit" className="btn btn-primary cut" disabled={pending}>
        {pending ? 'SAVING' : 'PLACE QUEST'}
      </button>

      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.9 }}>
        EXP は工数区分からシステムが決めます。値を直接指定することはできません。
      </p>
    </form>
  );
}
