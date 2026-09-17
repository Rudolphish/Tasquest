import { requireUser } from '@/lib/auth';
import { goals as goalsDb, logs as logsDb } from '@/lib/db';
import { CommandBar } from '@/components/nav';
import { Empty, SectionRule } from '@/components/ui';
import { LogForm } from './log-form';

export default async function LogPage() {
  const { db } = await requireUser();

  const [activeGoals, recentLogs] = await Promise.all([
    goalsDb.listActiveGoals(db),
    logsDb.listLogs(db, { limit: 30 }),
  ]);

  const titles = new Map(activeGoals.map((goal) => [goal.id, goal.title]));

  return (
    <>
      <main className="shell-main">
        <header
          style={{
            paddingBottom: 18,
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <span className="eyebrow">DAILY RECORD</span>
          <h1
            style={{
              margin: 0,
              fontSize: 27,
              fontWeight: 700,
              letterSpacing: '0.24em',
              textIndent: '0.24em',
            }}
          >
            記録
          </h1>
        </header>

        <div className="board" style={{ marginTop: 24, gridTemplateColumns: 'minmax(0, 1fr) 340px' }}>
          <section className="stack" style={{ gap: 14 }}>
            <SectionRule
              label="HISTORY"
              trailing={
                <span className="numeric" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                  {recentLogs.length}
                </span>
              }
            />

            {recentLogs.length === 0 ? (
              <Empty
                title="まだ記録がありません"
                body="続くかどうかがこのサービスの要です。まず一行だけでも書いてみてください。"
              />
            ) : (
              <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 0 }}>
                {recentLogs.map((log) => (
                  <li key={log.id} style={{ display: 'flex', gap: 14 }}>
                    <div
                      className="stack"
                      style={{ alignItems: 'center', flexShrink: 0, paddingTop: 5 }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          background: 'var(--cyan)',
                          transform: 'rotate(45deg)',
                        }}
                      />
                      <span style={{ width: 1, flexGrow: 1, background: '#12303d' }} />
                    </div>

                    <div className="stack" style={{ gap: 7, paddingBottom: 24, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <span
                          className="numeric"
                          style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-3)' }}
                        >
                          {log.logged_on.replaceAll('-', '.')}
                        </span>
                        {log.goal_id && titles.has(log.goal_id) && (
                          <a
                            href={`/goals/${log.goal_id}`}
                            style={{ fontSize: 11, color: 'var(--cyan-dim)' }}
                          >
                            {titles.get(log.goal_id)}
                          </a>
                        )}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          lineHeight: 1.95,
                          color: 'var(--text-2)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {log.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="panel stack" style={{ padding: '24px 22px', gap: 18, position: 'sticky', top: 20 }}>
            <SectionRule label="WRITE" />
            <LogForm goals={activeGoals.map(({ id, title }) => ({ id, title }))} />
          </aside>
        </div>
      </main>

      <CommandBar current="/log" />
    </>
  );
}
