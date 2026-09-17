'use client';

import { useActionState, useState } from 'react';
import { IDLE, type ActionState } from '@/lib/actions';
import { setBackgroundAction } from './actions';

const PLACEHOLDER = `例）
・今どこにいるか：職務経歴書は 3 年前のまま。面接は 2 年やっていない
・これまでの経緯：去年も一度動いたが、書類で止まって中断した
・制約：平日は夜のみ。土日はどちらか半日
・やり方の癖：調べ物より、手を動かすほうが続く`;

const LIMIT = 2000;

export function BackgroundForm({
  goalId,
  background,
  updatedAt,
  updatedBy,
}: {
  goalId: string;
  background: string | null;
  updatedAt: string | null;
  updatedBy: 'user' | 'cowork' | 'gemini';
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(setBackgroundAction, IDLE);
  const [editing, setEditing] = useState(background === null);
  const [draft, setDraft] = useState(background ?? '');

  const author = updatedBy === 'user' ? 'あなた' : updatedBy === 'cowork' ? 'Cowork' : 'AI';

  if (!editing) {
    return (
      <div className="stack" style={{ gap: 14 }}>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 2,
            color: 'var(--text-2)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {background}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span className="numeric" style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-3)' }}>
            {updatedAt ? `${updatedAt.slice(0, 10).replaceAll('-', '.')} · ${author}` : author}
          </span>
          <button
            type="button"
            className="btn btn-quiet"
            style={{ minHeight: 34, padding: '0 14px', fontSize: 11 }}
            onClick={() => setEditing(true)}
          >
            書き換える
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="goalId" value={goalId} />

      <label className="field">
        <span>
          今どこにいるか　
          <span className="numeric" style={{ color: draft.length > LIMIT ? 'var(--red)' : 'var(--text-3)' }}>
            {draft.length} / {LIMIT}
          </span>
        </span>
        <textarea
          name="background"
          maxLength={LIMIT}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={PLACEHOLDER}
          style={{ minHeight: 200 }}
        />
      </label>

      {state.status === 'error' && <p className="error">{state.message}</p>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="submit" className="btn btn-primary cut" disabled={pending}>
          {pending ? 'SAVING' : 'SAVE'}
        </button>
        {background !== null && (
          <button
            type="button"
            className="btn btn-quiet cut"
            onClick={() => {
              setDraft(background);
              setEditing(false);
            }}
          >
            やめる
          </button>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.9 }}>
        ここに書いた内容は、AI がクエストを考えるときの前提として読まれます。
        自分で書かずに、Cowork と話しながらまとめてもらうこともできます。
      </p>
    </form>
  );
}
