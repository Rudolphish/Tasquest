import { requireUser } from '@/lib/auth';
import { goals as goalsDb, player as playerDb, quests as questsDb } from '@/lib/db';
import { todayIso } from '@/lib/actions';
import { levelRatio, xpForLevel } from '@/lib/game';
import { CommandBar } from '@/components/nav';
import { CheckIcon, Empty, SectionRule } from '@/components/ui';
import { completeQuestAction, reopenQuestAction } from './actions';

export default async function TodayPage() {
  const { db } = await requireUser();
  const iso = todayIso();

  const [progress, activeGoals, todaysQuests] = await Promise.all([
    playerDb.getProgress(db),
    goalsDb.listActiveGoals(db),
    questsDb.listQuestsForDate(db, iso),
  ]);

  // クエストの目標名を引くための対応表。進行中でない目標のクエストも
  // 残りうるため、アクティブ分だけでは足りない。
  const questGoalIds = [...new Set(todaysQuests.map((quest) => quest.goal_id))];
  const relatedGoals = await goalsDb.listGoalsByIds(db, questGoalIds);
  const goalTitles = new Map(relatedGoals.map((goal) => [goal.id, goal.title]));

  const cleared = todaysQuests.filter((quest) => quest.status === 'done').length;
  const ratio = levelRatio(progress.totalXp, progress.level);

  return (
    <>
      <main className="shell-main">
        <div className="board">
          <PlayerPanel progress={progress} ratio={ratio} activeGoals={activeGoals} />

          <div className="stack" style={{ gap: 22 }}>
            <header
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 20,
                paddingBottom: 18,
                borderBottom: '1px solid var(--line)',
                flexWrap: 'wrap',
              }}
            >
              <div className="stack" style={{ gap: 8 }}>
                <span className="eyebrow">{iso.replaceAll('-', '.')}</span>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 27,
                    fontWeight: 700,
                    letterSpacing: '0.22em',
                    textIndent: '0.22em',
                  }}
                >
                  本日の任務
                </h1>
              </div>

              <div
                className="cut"
                style={{
                  padding: '9px 18px',
                  border: '1px solid var(--line)',
                  background: 'var(--panel-active)',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                }}
              >
                <span className="numeric" style={{ fontSize: 20, color: 'var(--cyan)' }}>
                  {cleared}
                </span>
                <span className="numeric" style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  / {todaysQuests.length} CLEARED
                </span>
              </div>
            </header>

            <section className="stack" style={{ gap: 14 }}>
              <SectionRule label="TODAY" />

              {todaysQuests.length === 0 ? (
                <Empty
                  title="本日のクエストはまだありません"
                  body="目標の画面からクエストを置けます。S7 以降は毎朝ここへ自動で並びます。"
                />
              ) : (
                <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 12 }}>
                  {todaysQuests.map((quest) => (
                    <QuestRow
                      key={quest.id}
                      quest={quest}
                      goalTitle={goalTitles.get(quest.goal_id) ?? '（削除された目標）'}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </main>

      <CommandBar current="/today" />
    </>
  );
}

function PlayerPanel({
  progress,
  ratio,
  activeGoals,
}: {
  progress: Awaited<ReturnType<typeof playerDb.getProgress>>;
  ratio: number;
  activeGoals: Awaited<ReturnType<typeof goalsDb.listActiveGoals>>;
}) {
  const dash = 2 * Math.PI * 48;

  return (
    <aside
      className="panel stack"
      style={{ padding: '26px 22px', gap: 26, position: 'sticky', top: 20 }}
    >
      <div className="stack" style={{ alignItems: 'center', gap: 14 }}>
        <div style={{ position: 'relative', width: 132, height: 132 }}>
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r="56" fill="none" stroke="#12303d" strokeWidth="1" />
            <circle cx="66" cy="66" r="48" fill="none" stroke="#102934" strokeWidth="6" />
            <circle
              cx="66"
              cy="66"
              r="48"
              fill="none"
              stroke="#35e8ff"
              strokeWidth="6"
              strokeDasharray={`${dash * ratio} ${dash}`}
              transform="rotate(-90 66 66)"
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              className="numeric"
              style={{ fontSize: 11, letterSpacing: '0.3em', color: 'var(--cyan-dim)' }}
            >
              LEVEL
            </span>
            <span
              className="numeric"
              style={{
                fontSize: 50,
                lineHeight: 0.95,
                color: 'var(--cyan)',
                textShadow: '0 0 16px rgba(53,232,255,.45)',
              }}
            >
              {progress.level}
            </span>
          </div>
        </div>

        <div className="stack" style={{ width: '100%', gap: 8 }}>
          <div className="meter">
            <span style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="numeric" style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {progress.totalXp.toLocaleString()} EXP
            </span>
            <span className="numeric" style={{ fontSize: 13, color: 'var(--cyan)' }}>
              +{Math.max(0, xpForLevel(progress.level + 1) - progress.totalXp)}
            </span>
          </div>
        </div>
      </div>

      <div className="stack" style={{ gap: 13 }}>
        <SectionRule label="STATUS" />
        <Bar label="継続" value={progress.currentStreak} unit="日" />
        <Bar label="最長" value={progress.longestStreak} unit="日" muted />
        <Bar label="休息" value={progress.restTokens} unit="枚" muted />
      </div>

      <div className="stack" style={{ gap: 13 }}>
        <SectionRule
          label="ACTIVE"
          trailing={
            <span className="numeric" style={{ fontSize: 12, color: 'var(--cyan)' }}>
              {activeGoals.length}/3
            </span>
          }
        />

        {activeGoals.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', lineHeight: 1.9 }}>
            進行中の目標がありません。<a href="/goals">目標を置く</a>
          </p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 9 }}>
            {activeGoals.map((goal) => (
              <li
                key={goal.id}
                style={{
                  background: 'var(--panel-active)',
                  borderLeft: '2px solid var(--cyan)',
                  padding: '11px 13px',
                }}
              >
                <a href={`/goals/${goal.id}`} style={{ color: 'var(--text)' }}>
                  <span
                    className="numeric"
                    style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--cyan-dim)' }}
                  >
                    SLOT 0{goal.active_slot}
                  </span>
                  <p style={{ margin: '5px 0 0', fontSize: 13, fontWeight: 500 }}>{goal.title}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form action="/auth/signout" method="post" style={{ marginTop: 4 }}>
        <button
          type="submit"
          className="btn btn-quiet"
          style={{ width: '100%', minHeight: 38, fontSize: 11 }}
        >
          SIGN OUT
        </button>
      </form>
    </aside>
  );
}

function Bar({
  label,
  value,
  unit,
  muted = false,
}: {
  label: string;
  value: number;
  unit: string;
  muted?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 12, color: 'var(--text-2)', width: 42 }}>{label}</span>
      <div style={{ flexGrow: 1, height: 5, background: '#0d2430' }}>
        <div
          style={{
            width: `${Math.min(100, value * 8)}%`,
            height: 5,
            background: muted ? 'var(--cyan-dim)' : 'var(--cyan)',
          }}
        />
      </div>
      <span className="numeric" style={{ fontSize: 14, width: 44, textAlign: 'right' }}>
        {value}
        <span style={{ fontSize: 10, color: 'var(--text-3)' }}> {unit}</span>
      </span>
    </div>
  );
}

function QuestRow({
  quest,
  goalTitle,
}: {
  quest: Awaited<ReturnType<typeof questsDb.listQuestsForDate>>[number];
  goalTitle: string;
}) {
  const done = quest.status === 'done';

  return (
    <li
      className="cut"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 18,
        padding: '18px 20px',
        background: done ? '#08170f' : 'var(--panel-active)',
        border: `1px solid ${done ? '#1d4433' : 'var(--line-strong)'}`,
        boxShadow: done ? 'none' : '0 0 24px rgba(53,232,255,.06)',
      }}
    >
      <div
        style={{
          width: 52,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
          borderRight: '1px solid var(--line)',
        }}
      >
        {done ? (
          <CheckIcon size={26} color="var(--green)" />
        ) : (
          <>
            <span className="numeric" style={{ fontSize: 26, color: 'var(--cyan)', lineHeight: 1 }}>
              {quest.effort}
            </span>
            <span
              className="numeric"
              style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--cyan-dim)' }}
            >
              COST
            </span>
          </>
        )}
      </div>

      <div className="stack" style={{ flexGrow: 1, gap: 8, minWidth: 0 }}>
        <span className="numeric" style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-3)' }}>
          {goalTitle}
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1.5,
            color: done ? '#46685c' : 'var(--text)',
            textDecoration: done ? 'line-through' : 'none',
            textDecorationColor: '#2a4a3b',
          }}
        >
          {quest.title}
        </h2>
        {quest.why && !done && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.75 }}>
            {quest.why}
          </p>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span
          className="numeric"
          style={{ fontSize: 26, color: done ? 'var(--green)' : 'var(--cyan)', lineHeight: 1 }}
        >
          {done ? '+' : ''}
          {quest.xp_value}
          <span style={{ fontSize: 12 }}> EXP</span>
        </span>

        <form action={done ? reopenQuestAction : completeQuestAction}>
          <input type="hidden" name="questId" value={quest.id} />
          <button type="submit" className={done ? 'btn btn-quiet cut' : 'btn btn-primary cut'}>
            {done ? 'UNDO' : 'CLEAR'}
          </button>
        </form>
      </div>
    </li>
  );
}
