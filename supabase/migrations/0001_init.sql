-- ---------------------------------------------------------------------------
-- Tasquest 初期スキーマ
--
-- 設計の根拠は docs/design.md を参照。本ファイルは以下を一括で定義する。
--   - 全テーブル（Phase 1 で未使用の goal_phases / retrospectives を含む）
--   - 行レベルセキュリティ（RLS）と所有者ポリシー
--   - アクティブ枠 3 件を保証する制約（D-1）
--   - AI が数値を書けないことを構造で保証する仕組み（D-4）
--   - AI からの書き込み経路となる RPC 3 本のシグネチャ（本体は S7 / S8）
--
-- RLS と制約を後から追加すると、既存データとの整合性確認が必要になり、
-- 適用漏れが静かに通過する。そのためテーブルと同一のマイグレーションに含める。
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. 列挙型
-- ===========================================================================

create type public.goal_status   as enum ('active', 'backlog', 'done', 'abandoned');
create type public.phase_status  as enum ('locked', 'active', 'done');
create type public.quest_effort  as enum ('S', 'M', 'L');
create type public.quest_status  as enum ('open', 'done', 'missed');
create type public.quest_source  as enum ('manual', 'cowork', 'gemini');
create type public.retro_kind    as enum ('miss', 'weekly');
create type public.retro_status  as enum ('open', 'resolved');
create type public.xp_source     as enum ('quest', 'streak_bonus', 'adjustment');
create type public.ai_run_status as enum ('succeeded', 'failed', 'partial');


-- ===========================================================================
-- 2. レベル曲線
--
-- レベルは total_xp の純粋関数として算出する。player 表に保持しない。
-- 係数は暫定値であり、Phase 2 で調整する（docs/design.md 第 9 章）。
-- ===========================================================================

create or replace function public.xp_for_level(p_level integer)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select (30 * power(greatest(p_level, 1) - 1, 2))::integer;
$$;

comment on function public.xp_for_level(integer) is
  '指定レベルに到達するために必要な累計 XP。level_for_xp と対になる。';

create or replace function public.level_for_xp(p_xp integer)
returns integer
language sql
immutable
parallel safe
set search_path = ''
as $$
  select greatest(1, floor(sqrt(greatest(p_xp, 0)::numeric / 30))::integer + 1);
$$;

comment on function public.level_for_xp(integer) is
  '累計 XP から現在のレベルを算出する。xp_for_level の逆関数。';


-- ===========================================================================
-- 3. player
--
-- 認証ユーザー 1 人につき 1 行。
-- total_xp と level は列として持たない。xp_events の集計から導出する（D-4）。
-- ===========================================================================

create table public.player (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  display_name           text,
  rest_tokens            smallint    not null default 1 check (rest_tokens between 0 and 3),
  rest_tokens_granted_on date,
  current_streak         integer     not null default 0 check (current_streak >= 0),
  longest_streak         integer     not null default 0 check (longest_streak >= 0),
  last_logged_on         date,
  created_at             timestamptz not null default now(),

  constraint player_longest_streak_is_max
    check (longest_streak >= current_streak)
);

comment on table  public.player is 'プレイヤー。XP とレベルは xp_events から導出するため列を持たない。';
comment on column public.player.rest_tokens is '未達を吸収する休息トークン。週 1 枚まで補充する（D-7）。';


-- ===========================================================================
-- 4. goals
--
-- アクティブ枠 3 件の保証:
--   active_slot を 1..3 に制限し、(user_id, active_slot) に部分一意索引を張る。
--   アプリ層の検証を迂回した書き込みでも 4 件目は必ず拒否される。
-- ===========================================================================

create table public.goals (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  title                  text not null check (length(btrim(title)) between 1 and 120),
  why                    text check (length(why) <= 500),
  status                 public.goal_status not null default 'backlog',
  active_slot            smallint check (active_slot between 1 and 3),
  share_with_external_ai boolean     not null default true,
  started_at             timestamptz,
  completed_at           timestamptz,
  created_at             timestamptz not null default now(),

  -- 子表からの複合外部キーが所有者の一致を検証できるようにする
  constraint goals_id_user_key unique (id, user_id),

  -- アクティブな目標は必ず枠を占め、それ以外は枠を持たない
  constraint goals_active_slot_consistency check (
    (status = 'active'  and active_slot is not null) or
    (status <> 'active' and active_slot is null)
  )
);

create unique index goals_active_slot_unique
  on public.goals (user_id, active_slot)
  where active_slot is not null;

create index goals_user_status_idx on public.goals (user_id, status);

comment on column public.goals.active_slot is
  'アクティブ枠の番号。1..3 の制限と部分一意索引により、同時進行は 3 件までとなる（D-1）。';
comment on column public.goals.share_with_external_ai is
  '外部 AI への送信可否。false の目標は日次生成のプロンプトから除外する（D-6）。';


-- ===========================================================================
-- 5. goal_phases
--
-- 章数（4）と遷移条件はシステムが固定し、名称と狙いを AI が生成する（D-8）。
-- edited_by_user が true の行は AI の書き戻し対象から外す（D-9）。
-- ===========================================================================

create table public.goal_phases (
  id              uuid primary key default gen_random_uuid(),
  goal_id         uuid     not null,
  user_id         uuid     not null,
  phase_no        smallint not null check (phase_no between 1 and 4),
  name            text     not null check (length(btrim(name)) between 1 and 60),
  intent          text     check (length(intent) <= 300),
  quests_required smallint not null default 6 check (quests_required between 1 and 20),
  status          public.phase_status not null default 'locked',
  edited_by_user  boolean     not null default false,
  created_at      timestamptz not null default now(),

  constraint goal_phases_goal_phase_key unique (goal_id, phase_no),
  constraint goal_phases_id_user_key    unique (id, user_id),

  -- 目標の所有者と一致しない行を作れないようにする
  foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade
);

create index goal_phases_goal_idx on public.goal_phases (goal_id, phase_no);

comment on column public.goal_phases.edited_by_user is
  '利用者が編集した章。true の行は AI による上書きの対象外とする（D-9）。';


-- ===========================================================================
-- 6. quests
--
-- xp_value は生成列であり、直接の書き込みを PostgreSQL が拒否する。
-- AI が工数区分（effort）を決め、XP 値はシステムが決めるという責務境界を
-- アプリ層の約束ではなくスキーマで保証する（D-4）。
-- 値は暫定であり、変更は明示的なマイグレーションを要する。
-- ===========================================================================

create table public.quests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  goal_id      uuid not null,
  phase_id     uuid,
  title        text not null check (length(btrim(title)) between 1 and 160),
  why          text check (length(why) <= 500),
  effort       public.quest_effort not null,
  xp_value     integer generated always as (
                 case effort
                   when 'S' then 10
                   when 'M' then 25
                   when 'L' then 60
                 end
               ) stored,
  status       public.quest_status not null default 'open',
  due_on       date not null,
  generated_by public.quest_source not null default 'manual',
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),

  constraint quests_id_user_key unique (id, user_id),

  constraint quests_completed_at_consistency check (
    (status = 'done'  and completed_at is not null) or
    (status <> 'done' and completed_at is null)
  ),

  foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  foreign key (phase_id, user_id)
    references public.goal_phases (id, user_id) on delete set null (phase_id)
);

create index quests_user_due_idx    on public.quests (user_id, due_on desc);
create index quests_goal_status_idx on public.quests (goal_id, status);

comment on column public.quests.xp_value is
  '工数区分から導出される生成列。直接の更新は拒否される（D-4）。';


-- ===========================================================================
-- 7. logs
-- ===========================================================================

create table public.logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  goal_id    uuid,
  quest_id   uuid,
  body       text not null check (length(btrim(body)) between 1 and 4000),
  logged_on  date not null default current_date,
  created_at timestamptz not null default now(),

  foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  foreign key (quest_id, user_id)
    references public.quests (id, user_id) on delete set null (quest_id)
);

create index logs_user_logged_on_idx on public.logs (user_id, logged_on desc);


-- ===========================================================================
-- 8. retrospectives
--
-- 未達は罰ではなく診断のトリガーとして扱う（D-7）。
-- ===========================================================================

create table public.retrospectives (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  goal_id           uuid,
  kind              public.retro_kind   not null,
  status            public.retro_status not null default 'open',
  trigger_quest_ids uuid[] not null default '{}',
  insight           text   check (length(insight) <= 4000),
  resolved_at       timestamptz,
  created_at        timestamptz not null default now(),

  -- 解決済みの振り返りは、結論と解決時刻を必ず伴う
  constraint retrospectives_resolved_requires_insight check (
    status = 'open' or (insight is not null and resolved_at is not null)
  ),

  foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade
);

-- 未処理の振り返りが 5 件を超えた場合は新規生成せず既存に集約する方針のため、
-- 未処理件数の参照を高速に行えるようにする（docs/design.md 6.2）。
create index retrospectives_open_idx
  on public.retrospectives (user_id, created_at desc)
  where status = 'open';


-- ===========================================================================
-- 9. xp_events
--
-- XP の唯一の源泉。追記のみを想定する台帳。
--   - amount > 0 により、XP が減らないことを制約で保証する（D-7）
--   - quest_id の部分一意索引により、同一クエストの二重加算を防ぐ
-- ===========================================================================

create table public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  source     public.xp_source not null,
  quest_id   uuid,
  amount     integer not null check (amount > 0),
  note       text check (length(note) <= 200),
  created_at timestamptz not null default now(),

  foreign key (quest_id, user_id)
    references public.quests (id, user_id) on delete set null (quest_id)
);

create unique index xp_events_quest_unique
  on public.xp_events (quest_id)
  where quest_id is not null;

create index xp_events_user_idx on public.xp_events (user_id);

comment on table public.xp_events is
  'XP の加算台帳。累計は本表の集計から導出し、player 表には保持しない。';


-- ===========================================================================
-- 10. ai_runs
--
-- 「生成を試みた」と「生成できた」を区別する。
-- 失敗した実行が「本日は生成済み」と判定される事故を防ぐため、
-- 判定は status = 'succeeded' の行のみを見る（実装プラン S-4）。
-- ===========================================================================

create table public.ai_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  provider       text not null,
  model          text not null,
  purpose        text not null,
  status         public.ai_run_status not null,
  target_on      date not null,
  prompt_summary text check (length(prompt_summary) <= 4000),
  error          text check (length(error) <= 2000),
  created_at     timestamptz not null default now(),

  -- 失敗した実行には理由を残す
  constraint ai_runs_failure_has_error check (
    status <> 'failed' or error is not null
  )
);

-- 「その日の生成が成功しているか」の判定に用いる。失敗した行は含まない。
create unique index ai_runs_succeeded_unique
  on public.ai_runs (user_id, purpose, target_on)
  where status = 'succeeded';

comment on index public.ai_runs_succeeded_unique is
  '成功した実行のみを一意とする。失敗した実行は再試行を妨げない（実装プラン S-4）。';


-- ===========================================================================
-- 11. 集計ビュー
--
-- security_invoker を有効にする。既定ではビューは所有者の権限で実行され、
-- 参照元テーブルの RLS が適用されない。
-- ===========================================================================

create view public.player_progress
with (security_invoker = on) as
select
  p.user_id,
  coalesce(x.total_xp, 0)                              as total_xp,
  public.level_for_xp(coalesce(x.total_xp, 0))         as level,
  public.xp_for_level(
    public.level_for_xp(coalesce(x.total_xp, 0)) + 1)  as next_level_xp,
  p.current_streak,
  p.longest_streak,
  p.rest_tokens
from public.player p
left join (
  select user_id, sum(amount)::integer as total_xp
  from public.xp_events
  group by user_id
) x on x.user_id = p.user_id;


-- ===========================================================================
-- 12. AI からの書き込み経路（RPC）
--
-- AI に許可する書き込みはこの 3 本のみとする（D-10）。
-- いずれも XP 値を引数に取らない。本体は S7 / S8 で実装する。
-- security invoker のため、呼び出し元の RLS がそのまま適用される。
-- ===========================================================================

create or replace function public.propose_quests(p_payload jsonb)
returns setof public.quests
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'propose_quests は未実装（S7 で実装する）'
    using errcode = '0A000';
end;
$$;

comment on function public.propose_quests(jsonb) is
  'クエストの提案を受け取る。goal_id / title / why / effort のみを解釈し、XP 値は受け取らない。';

create or replace function public.propose_phases(p_goal_id uuid, p_phases jsonb)
returns setof public.goal_phases
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'propose_phases は未実装（S7 で実装する）'
    using errcode = '0A000';
end;
$$;

comment on function public.propose_phases(uuid, jsonb) is
  '章の名称と狙いを受け取る。章数と遷移条件は受け取らない。edited_by_user が true の章は無視する。';

create or replace function public.record_insight(p_retro_id uuid, p_insight text)
returns public.retrospectives
language plpgsql
security invoker
set search_path = ''
as $$
begin
  raise exception 'record_insight は未実装（S8 で実装する）'
    using errcode = '0A000';
end;
$$;

comment on function public.record_insight(uuid, text) is
  '振り返りの結論を書き戻す。status は resolved へ遷移させる。';


-- ===========================================================================
-- 13. 行レベルセキュリティ
--
-- 全テーブルで有効化し、所有者のみが読み書きできるようにする。
-- auth.uid() は副問い合わせで包む（行ごとの再評価を避けるため）。
-- ===========================================================================

alter table public.player         enable row level security;
alter table public.goals          enable row level security;
alter table public.goal_phases    enable row level security;
alter table public.quests         enable row level security;
alter table public.logs           enable row level security;
alter table public.retrospectives enable row level security;
alter table public.xp_events      enable row level security;
alter table public.ai_runs        enable row level security;

-- 所有者以外を遮断する。テーブル所有者にも適用する。
alter table public.player         force row level security;
alter table public.goals          force row level security;
alter table public.goal_phases    force row level security;
alter table public.quests         force row level security;
alter table public.logs           force row level security;
alter table public.retrospectives force row level security;
alter table public.xp_events      force row level security;
alter table public.ai_runs        force row level security;

create policy player_owner on public.player
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy goals_owner on public.goals
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy goal_phases_owner on public.goal_phases
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy quests_owner on public.quests
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy logs_owner on public.logs
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy retrospectives_owner on public.retrospectives
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy xp_events_owner on public.xp_events
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy ai_runs_owner on public.ai_runs
  for all to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);


-- ===========================================================================
-- 14. 権限
--
-- RLS を唯一の防衛線にせず、未認証ロールからは権限自体を剥奪する。
-- ロールが存在しない環境（検証用の PGlite など）では何もしない。
-- ===========================================================================

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables    in schema public from anon;
    revoke all on all functions in schema public from anon;
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant execute on all functions in schema public to authenticated;
  end if;
end
$$;


-- ===========================================================================
-- 15. 新規ユーザーに対する player 行の作成
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.player (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

do $$
begin
  if to_regclass('auth.users') is not null then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end
$$;
