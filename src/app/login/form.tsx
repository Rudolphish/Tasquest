'use client';

import { useActionState } from 'react';
import { sendMagicLink, type SignInState } from './actions';

const INITIAL: SignInState = { status: 'idle' };

export function LoginForm() {
  const [state, action, pending] = useActionState(sendMagicLink, INITIAL);

  if (state.status === 'sent') {
    return (
      <p
        style={{
          margin: 0,
          padding: '16px 18px',
          border: '1px solid var(--line-strong)',
          background: 'var(--panel-active)',
          fontSize: 13,
          lineHeight: 1.9,
          color: 'var(--text-2)',
        }}
      >
        リンクを送りました。メールを開いて、記載のリンクからログインしてください。
      </p>
    );
  }

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>メールアドレス</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          style={{
            height: 44,
            padding: '0 14px',
            background: '#040c11',
            border: '1px solid var(--line)',
            color: 'var(--text)',
            outlineColor: 'var(--cyan)',
          }}
        />
      </label>

      {state.status === 'error' && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--red)', lineHeight: 1.8 }}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="numeric"
        style={{
          height: 48,
          border: 'none',
          background: pending ? 'var(--cyan-dim)' : 'var(--cyan)',
          color: '#05090d',
          fontSize: 15,
          letterSpacing: '0.24em',
        }}
      >
        {pending ? 'SENDING' : 'SEND LINK'}
      </button>
    </form>
  );
}
