import { requireUser } from '@/lib/auth';
import { goals as goalsDb, player as playerDb, quests as questsDb } from '@/lib/db';
import { SignOutButton } from './sign-out';

/** その日の日付を、データベースの date 列と同じ形にする。 */
function today(): string {
  return new Date().toLocaleDateString('sv-SE');
}

export default async function TodayPage() {
  const { db } = await requireUser();

  const [progress, activeGoals, todaysQuests] = await Promise.all([
    playerDb.getProgress(db),
    goalsDb.listActiveGoals(db),
    questsDb.listQuestsForDate(db, today()),
  ]);

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 24,
          paddingBottom: 20,
          borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="eyebrow">{today().replaceAll('-', '.')}</span>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textIndent: '0.22em',
            }}
          >
            本日の任務
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <Stat label="LEVEL" value={progress.level} />
          <Stat label="EXP" value={progress.totalXp} />
          <Stat label="STREAK" value={progress.currentStreak} />
          <SignOutButton />
        </div>
      </header>

      <section style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span className="eyebrow">TODAY</span>

        {todaysQuests.length === 0 ? (
          <Empty
            title="本日のクエストはまだありません"
            body="目標を進行中にすると、その目標の章に沿ってクエストを置けるようになります。"
          />
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {todaysQuests.map((quest) => (
              <li key={quest.id} className="panel" style={{ padding: '18px 20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <span style={{ fontSize: 15, fontWeight: 700 }}>{quest.title}</span>
                  <span className="numeric" style={{ color: 'var(--cyan)', fontSize: 15 }}>
                    +{quest.xp_value} EXP
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span className="eyebrow">ACTIVE SLOTS</span>
          <span className="numeric" style={{ fontSize: 12, color: 'var(--cyan)' }}>
            {activeGoals.length} / 3
          </span>
        </div>

        {activeGoals.length === 0 ? (
          <Empty
            title="進行中の目標がありません"
            body="同時に進められるのは 3 件までです。まず 1 件から始めてください。"
          />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            }}
          >
            {activeGoals.map((goal) => (
              <li key={goal.id} className="panel" style={{ padding: '18px 20px' }}>
                <a href={`/goals/${goal.id}`} style={{ color: 'var(--text)' }}>
                  <span
                    className="numeric"
                    style={{ fontSize: 11, letterSpacing: '0.2em', color: 'var(--cyan-dim)' }}
                  >
                    SLOT 0{goal.active_slot}
                  </span>
                  <p style={{ margin: '8px 0 0', fontSize: 15, fontWeight: 700 }}>{goal.title}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span
        className="numeric"
        style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--text-3)' }}
      >
        {label}
      </span>
      <span className="numeric" style={{ fontSize: 22, color: 'var(--cyan)', lineHeight: 1 }}>
        {value}
      </span>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: '28px 24px',
        border: '1px dashed var(--line-strong)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{title}</p>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.9 }}>{body}</p>
    </div>
  );
}
