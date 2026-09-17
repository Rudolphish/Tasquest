'use client';

import { useActionState } from 'react';
import { IDLE, type ActionState } from '@/lib/actions';
import { createGoalAction } from './actions';

export function NewGoalForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(createGoalAction, IDLE);

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <label className="field">
        <span>目標</span>
        <input name="title" required maxLength={120} placeholder="英語で技術発表する" />
      </label>

      <label className="field">
        <span>なぜやるのか（任意）</span>
        <input
          name="why"
          maxLength={500}
          placeholder="社内勉強会で、通訳なしで 20 分話し切れるようになるため"
        />
      </label>

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--text-2)' }}>
        <input type="checkbox" name="share" defaultChecked style={{ width: 16, minHeight: 16 }} />
        この目標を外部 AI への入力に含める
      </label>

      {state.status === 'error' && <p className="error">{state.message}</p>}
      {state.status === 'ok' && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--green)' }}>控えに追加しました。</p>
      )}

      <button type="submit" className="btn btn-primary cut" disabled={pending}>
        {pending ? 'SAVING' : 'ADD TO RESERVE'}
      </button>

      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.9 }}>
        作成した目標は控えに入ります。進行中にできるのは 3 件までです。
      </p>
    </form>
  );
}
