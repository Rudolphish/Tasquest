import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { LoginForm } from './form';

export default async function LoginPage() {
  if (await currentUser()) redirect('/today');

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="panel"
        style={{ width: '100%', maxWidth: 420, padding: '36px 32px' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
          <span className="eyebrow">TASQUEST</span>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textIndent: '0.2em',
            }}
          >
            ログイン
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.8 }}>
            登録済みのメールアドレスにログイン用のリンクを送ります。
          </p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
