import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { goals as goalsDb } from '@/lib/db';

/**
 * 目標の詳細。
 *
 * ID を受け取るページであるため、ここで所有者を確認する。
 *
 * Server Component はデータベースを直接読むため、API ルート側の権限判定を
 * 通らない。レイアウトが見ているのは「ログインしているか」だけであり、
 * 「その目標を見てよいか」は判定していない。
 * 行レベルセキュリティにより他人の行は取得できないが、それを唯一の
 * 防衛線にはしない。取得できなかった時点で notFound() とする。
 *
 * 存在しない場合と権限がない場合を区別せず、いずれも 404 として扱う。
 * 403 を返すと、その ID の目標が存在することを漏らしてしまうため。
 */
export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireUser();

  const goal = await goalsDb.getGoal(db, id);
  if (!goal) notFound();

  const phases = await goalsDb.listPhases(db, goal.id);

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px' }}>
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          paddingBottom: 20,
          borderBottom: '1px solid var(--line)',
        }}
      >
        <span className="eyebrow">
          {goal.status === 'active' ? `SLOT 0${goal.active_slot}` : goal.status.toUpperCase()}
        </span>
        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textIndent: '0.18em',
          }}
        >
          {goal.title}
        </h1>
        {goal.why && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.9 }}>
            {goal.why}
          </p>
        )}
      </header>

      <section style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="eyebrow">PROGRESSION</span>

        {phases.length === 0 ? (
          <div
            style={{
              padding: '28px 24px',
              border: '1px dashed var(--line-strong)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>章がまだありません</p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.9 }}>
              章は 4 つで固定です。名称と狙いは自分で書くか、S7 以降は AI が提案します。
            </p>
          </div>
        ) : (
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            }}
          >
            {phases.map((phase) => (
              <li key={phase.id} className="panel" style={{ padding: '16px 18px' }}>
                <span
                  className="numeric"
                  style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--cyan-dim)' }}
                >
                  CHAPTER {'I'.repeat(phase.phase_no)}
                </span>
                <p style={{ margin: '8px 0 6px', fontSize: 15, fontWeight: 700 }}>{phase.name}</p>
                {phase.intent && (
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7 }}>
                    {phase.intent}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <p style={{ marginTop: 32, fontSize: 13 }}>
        <a href="/today">← 本日の任務へ戻る</a>
      </p>
    </main>
  );
}
