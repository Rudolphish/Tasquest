import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { goals as goalsDb, logs as logsDb, quests as questsDb } from '@/lib/db';
import { todayIso } from '@/lib/actions';
import { CommandBar } from '@/components/nav';
import { CheckIcon, Empty, SectionRule } from '@/components/ui';
import { deleteQuestAction } from './actions';
import { NewQuestForm } from './new-quest-form';
import { BackgroundForm } from './background-form';

/**
 * 目標の詳細。
 *
 * ID を受け取るページであるため、ここで所有者を確認する。
 *
 * Server Component はデータベースを直接読むため、API ルート側の権限判定を
 * 通らない。レイアウトが見ているのは「ログインしているか」だけであり、
 * 「その目標を見てよいか」は判定していない。行レベルセキュリティにより
 * 他人の行は取得できないが、それを唯一の防衛線にはしない。
 *
 * 存在しない場合と権限がない場合を区別せず、いずれも 404 として扱う。
 * 403 を返すと、その ID の目標が存在することを漏らしてしまうため。
 */
export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireUser();

  const goal = await goalsDb.getGoal(db, id);
  if (!goal) notFound();

  const [phases, quests, recentLogs] = await Promise.all([
    goalsDb.listPhases(db, goal.id),
    questsDb.listQuestsForGoal(db, goal.id),
    logsDb.listLogs(db, { goalId: goal.id, limit: 8 }),
  ]);

  const cleared = quests.filter((quest) => quest.status === 'done').length;

  return (
    <>
      <main className="shell-main">
        <header
          style={{
            paddingBottom: 18,
            borderBottom: '1px solid var(--line)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
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

        <div className="board" style={{ marginTop: 24, gridTemplateColumns: 'minmax(0, 1fr) 340px' }}>
          <div className="stack" style={{ gap: 30 }}>
            <section className="stack" style={{ gap: 14 }}>
              <SectionRule
                label="BACKGROUND"
                trailing={
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    AI がクエストを考えるときの前提になります
                  </span>
                }
              />
              <div className="panel" style={{ padding: '20px 22px' }}>
                {goal.background === null && (
                  <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.9 }}>
                    今の習熟度、これまでの経緯、時間や道具の制約を書いておくと、
                    提案の当たりが良くなります。記録からは読み取れない情報だからです。
                  </p>
                )}
                <BackgroundForm
                  goalId={goal.id}
                  background={goal.background}
                  updatedAt={goal.background_updated_at}
                  updatedBy={goal.background_updated_by}
                />
              </div>
            </section>

            <section className="stack" style={{ gap: 14 }}>
              <SectionRule label="PROGRESSION" />
              {phases.length === 0 ? (
                <Empty
                  title="章がまだありません"
                  body="章は 4 つで固定です。名称と狙いは S7 以降、AI が目標ごとに提案します。"
                />
              ) : (
                <ol
                  style={{
                    listStyle: 'none',
                    margin: 0,
                    padding: 0,
                    display: 'grid',
                    gap: 12,
                    gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
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

            <section className="stack" style={{ gap: 14 }}>
              <SectionRule
                label="QUESTS"
                trailing={
                  <span className="numeric" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    CLEARED {cleared} / {quests.length}
                  </span>
                }
              />

              {quests.length === 0 ? (
                <Empty title="クエストがありません" body="右のフォームから置いてください。" />
              ) : (
                <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 9 }}>
                  {quests.map((quest) => {
                    const done = quest.status === 'done';
                    return (
                      <li
                        key={quest.id}
                        className="cut"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '14px 18px',
                          background: done ? '#08170f' : 'var(--panel)',
                          border: `1px solid ${done ? '#1d4433' : 'var(--line)'}`,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                          {done ? (
                            <CheckIcon size={18} color="var(--green)" />
                          ) : (
                            <span className="numeric" style={{ fontSize: 15, color: 'var(--text-2)' }}>
                              {quest.effort}
                            </span>
                          )}
                        </span>

                        <span
                          style={{
                            flexGrow: 1,
                            fontSize: 14,
                            minWidth: 160,
                            color: done ? '#46685c' : 'var(--text)',
                            textDecoration: done ? 'line-through' : 'none',
                            textDecorationColor: '#2a4a3b',
                          }}
                        >
                          {quest.title}
                        </span>

                        <span className="numeric" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                          {quest.due_on}
                        </span>

                        <span
                          className="numeric"
                          style={{
                            fontSize: 15,
                            width: 76,
                            textAlign: 'right',
                            color: done ? 'var(--green)' : 'var(--cyan)',
                          }}
                        >
                          {quest.xp_value} EXP
                        </span>

                        {!done && (
                          <form action={deleteQuestAction}>
                            <input type="hidden" name="questId" value={quest.id} />
                            <input type="hidden" name="goalId" value={goal.id} />
                            <button
                              type="submit"
                              className="btn btn-quiet"
                              style={{ minHeight: 34, padding: '0 12px', fontSize: 11 }}
                            >
                              取り消す
                            </button>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="stack" style={{ gap: 14 }}>
              <SectionRule label="RECORDS" />
              {recentLogs.length === 0 ? (
                <Empty title="記録がありません" body="記録の画面から、この目標に紐づけて書けます。" />
              ) : (
                <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 14 }}>
                  {recentLogs.map((log) => (
                    <li key={log.id} className="stack" style={{ gap: 6 }}>
                      <span
                        className="numeric"
                        style={{ fontSize: 11, letterSpacing: '0.14em', color: 'var(--text-3)' }}
                      >
                        {log.logged_on.replaceAll('-', '.')}
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          lineHeight: 1.9,
                          color: 'var(--text-2)',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {log.body}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="panel stack" style={{ padding: '24px 22px', gap: 18 }}>
            <SectionRule label="PLACE QUEST" />
            <NewQuestForm goalId={goal.id} today={todayIso()} />
          </aside>
        </div>
      </main>

      <CommandBar current="/goals" />
    </>
  );
}
