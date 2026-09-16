'use client';

import { useActionState } from 'react';
import { IDLE, type ActionState } from '@/lib/actions';
import { createLogAction } from './actions';

export function LogForm({ goals }: { goals: { id: string; title: string }[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createLogAction, IDLE);

  return (
    <form action={action} className="stack" style={{ gap: 16 }}>
      <label className="field">
        <span>今日のこと</span>
        <textarea
          name="body"
          required
          maxLength={4000}
          placeholder="できたこと、詰まったこと、やらなかった理由"
        />
      </label>

      <label className="field">
        <span>目標に紐づける（任意）</span>
        <select name="goalId" defaultValue="">
          <option value="">紐づけない</option>
          {goals.map((goal) => (
            <option key={goal.id} value={goal.id}>
              {goal.title}
            </option>
          ))}
        </select>
      </label>

      {state.status === 'error' && <p className="error">{state.message}</p>}
      {state.status === 'ok' && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--green)' }}>記録しました。</p>
      )}

      <button type="submit" className="btn btn-primary cut" disabled={pending}>
        {pending ? 'SAVING' : 'RECORD'}
      </button>
    </form>
  );
}
