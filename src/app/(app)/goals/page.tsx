import { requireUser } from '@/lib/auth';
import { goals as goalsDb } from '@/lib/db';
import { CommandBar } from '@/components/nav';
import { Empty, SectionRule } from '@/components/ui';
import { activateGoalAction, releaseGoalAction } from './actions';
import { NewGoalForm } from './new-goal-form';

type Goal = Awaited<ReturnType<typeof goalsDb.listGoals>>[number];

export default async function GoalsPage() {
  const { db } = await requireUser();
  const all = await goalsDb.listGoals(db);

  const active = all.filter((goal) => goal.status === 'active');
  const backlog = all.filter((goal) => goal.status === 'backlog');
  const finished = all.filter((goal) => goal.status === 'done' || goal.status === 'abandoned');
  const slotsFull = active.length >= 3;

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
          <span className="eyebrow">QUEST REGISTRY</span>
          <h1
            style={{
              margin: 0,
              fontSize: 27,
              fontWeight: 700,
              letterSpacing: '0.24em',
              textIndent: '0.24em',
            }}
          >
            目標
          </h1>
        </header>

        <div className="board" style={{ marginTop: 24, gridTemplateColumns: 'minmax(0, 1fr) 340px' }}>
          <div className="stack" style={{ gap: 30 }}>
            <section className="stack" style={{ gap: 14 }}>
              <SectionRule
                label="ACTIVE SLOTS"
                trailing={
                  <span className="numeric" style={{ fontSize: 12, color: 'var(--cyan)' }}>
                    {active.length}/3
                  </span>
                }
              />

              {active.length === 0 ? (
                <Empty
                  title="進行中の目標がありません"
                  body="控えから 1 件を進行中にしてください。同時に進められるのは 3 件までです。"
                />
              ) : (
                <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
                  {active.map((goal) => (
                    <ActiveCard key={goal.id} goal={goal} />
                  ))}
                </ul>
              )}
            </section>

            <section className="stack" style={{ gap: 14 }}>
              <SectionRule label="RESERVE" />

              {backlog.length === 0 ? (
                <Empty title="控えは空です" body="思いついた目標をここに貯めておけます。" />
              ) : (
                <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 10 }}>
                  {backlog.map((goal) => (
                    <ReserveRow key={goal.id} goal={goal} slotsFull={slotsFull} />
                  ))}
                </ul>
              )}
            </section>

            {finished.length > 0 && (
              <section className="stack" style={{ gap: 14 }}>
                <SectionRule label="ARCHIVE" />
                <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 10 }}>
                  {finished.map((goal) => (
                    <li
                      key={goal.id}
                      style={{
                        padding: '14px 18px',
                        background: '#060f15',
                        border: '1px solid #0f2730',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                      }}
                    >
                      <span
                        className="numeric"
                        style={{ fontSize: 11, letterSpacing: '0.16em', color: 'var(--text-3)' }}
                      >
                        {goal.status === 'done' ? 'CLEARED' : 'DROPPED'}
                      </span>
                      <a href={`/goals/${goal.id}`} style={{ color: 'var(--text-2)', fontSize: 14 }}>
                        {goal.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="panel stack" style={{ padding: '24px 22px', gap: 18 }}>
            <SectionRule label="NEW QUEST" />
            <NewGoalForm />
          </aside>
        </div>
      </main>

      <CommandBar current="/goals" />
    </>
  );
}

function ActiveCard({ goal }: { goal: Goal }) {
  return (
    <li
      className="cut stack"
      style={{
        padding: '20px 22px',
        background: 'var(--panel-active)',
        border: '1px solid var(--line-strong)',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span
          className="numeric"
          style={{ fontSize: 11, letterSpacing: '0.22em', color: 'var(--cyan-dim)' }}
        >
          SLOT 0{goal.active_slot}
        </span>
        <span
          className="numeric"
          style={{ fontSize: 10, letterSpacing: '0.16em', color: goal.share_with_external_ai ? 'var(--cyan-dim)' : 'var(--text-3)' }}
        >
          {goal.share_with_external_ai ? 'AI 連携 ON' : 'AI 連携 OFF'}
        </span>
      </div>

      <a href={`/goals/${goal.id}`} style={{ color: 'var(--text)' }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: '0.06em' }}>
          {goal.title}
        </h2>
      </a>

      {goal.why && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.8 }}>{goal.why}</p>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 4 }}>
        <a href={`/goals/${goal.id}`} className="btn btn-quiet cut">
          開く
        </a>
        <form action={releaseGoalAction}>
          <input type="hidden" name="goalId" value={goal.id} />
          <input type="hidden" name="to" value="done" />
          <button type="submit" className="btn cut">
            達成した
          </button>
        </form>
        <form action={releaseGoalAction}>
          <input type="hidden" name="goalId" value={goal.id} />
          <input type="hidden" name="to" value="backlog" />
          <button type="submit" className="btn btn-quiet cut">
            控えへ戻す
          </button>
        </form>
      </div>
    </li>
  );
}

function ReserveRow({ goal, slotsFull }: { goal: Goal; slotsFull: boolean }) {
  return (
    <li
      style={{
        padding: '16px 18px',
        background: '#060f15',
        border: '1px dashed var(--line-strong)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div className="stack" style={{ gap: 5, minWidth: 0 }}>
        <a href={`/goals/${goal.id}`} style={{ color: 'var(--text-2)', fontSize: 15, fontWeight: 700 }}>
          {goal.title}
        </a>
        {goal.why && <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)' }}>{goal.why}</p>}
      </div>

      <form action={activateGoalAction}>
        <input type="hidden" name="goalId" value={goal.id} />
        <button type="submit" className="btn cut" disabled={slotsFull}>
          {slotsFull ? 'SLOTS FULL' : 'DEPLOY'}
        </button>
      </form>
    </li>
  );
}
