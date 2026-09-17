-- ---------------------------------------------------------------------------
-- AI からのクエスト提案を受け付ける経路を実装する。
--
-- 設計上、AI からの書き込みはこの関数を含む 3 本の RPC のみに限る（D-10）。
-- 本関数は XP 値を受け取らない。工数区分のみを解釈し、XP は生成列が決める（D-4）。
--
-- あわせて「今日」の定義をデータベース側にも置く。実行環境の時刻ではなく
-- 利用者の生活時間で日付を決めないと、連続記録の判定がずれる。
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. 日付の境界
-- ===========================================================================

create or replace function public.app_today()
returns date
language sql
stable
parallel safe
set search_path = ''
as $$
  select (now() at time zone 'Asia/Tokyo')::date;
$$;

comment on function public.app_today() is
  '利用者の生活時間における今日の日付。実行環境の時刻帯に依存しない。'
  'アプリ側の src/lib/clock.ts と同じ定義であり、検査で一致を確認している。';


-- ===========================================================================
-- 2. クエストの提案
--
-- 受け取る形式は次のいずれか。
--
--   [ { goal_id, title, why?, effort, due_on? }, ... ]
--   { "source": "cowork" | "gemini", "quests": [ 同上 ] }
--
-- 受け取らないもの: xp_value、status、phase_id。
-- いずれもシステムが決めるか、この経路では設定しない。
-- ===========================================================================

create or replace function public.propose_quests(p_payload jsonb)
returns setof public.quests
language plpgsql
security invoker
set search_path = ''
as $$
declare
  k_daily_limit constant integer := 3;

  v_user   uuid := auth.uid();
  v_source public.quest_source;
  v_raw    jsonb;
  v_clean  jsonb := '[]'::jsonb;
  v_item   jsonb;

  v_goal_id uuid;
  v_title   text;
  v_why     text;
  v_effort  text;
  v_due     date;

  v_status  public.goal_status;
  v_share   boolean;

  v_day     date;
  v_adding  integer;
  v_existing integer;
begin
  if v_user is null then
    raise exception 'ログインしていません。' using errcode = '28000';
  end if;

  -- --- 受け取り形式の吸収 ------------------------------------------------
  if jsonb_typeof(p_payload) = 'array' then
    v_raw := p_payload;
    v_source := 'cowork';
  elsif jsonb_typeof(p_payload) = 'object' then
    v_raw := coalesce(p_payload -> 'quests', 'null'::jsonb);
    if jsonb_typeof(v_raw) <> 'array' then
      raise exception 'quests に配列を渡してください。';
    end if;

    if p_payload ? 'source' then
      if p_payload ->> 'source' not in ('cowork', 'gemini') then
        raise exception 'source は cowork か gemini のいずれかです。';
      end if;
      v_source := (p_payload ->> 'source')::public.quest_source;
    else
      v_source := 'cowork';
    end if;
  else
    raise exception '配列、または quests を持つオブジェクトを渡してください。';
  end if;

  if jsonb_array_length(v_raw) = 0 then
    raise exception 'クエストが 1 件も含まれていません。';
  end if;

  -- --- 1 件ずつ検証し、正規化した配列を作る ------------------------------
  for v_item in select * from jsonb_array_elements(v_raw)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'クエストはオブジェクトで渡してください。';
    end if;

    -- 目標
    if (v_item ->> 'goal_id') is null then
      raise exception 'goal_id は必須です。';
    end if;
    begin
      v_goal_id := (v_item ->> 'goal_id')::uuid;
    exception when others then
      raise exception 'goal_id が UUID ではありません: %', v_item ->> 'goal_id';
    end;

    -- 所有者と状態。RLS により他人の行はそもそも見えない。
    select g.status, g.share_with_external_ai
      into v_status, v_share
      from public.goals g
     where g.id = v_goal_id;

    if not found then
      raise exception '目標が見つかりません: %', v_goal_id using errcode = 'P0002';
    end if;

    if v_status <> 'active' then
      raise exception '進行中でない目標にはクエストを置けません: %', v_goal_id;
    end if;

    -- 外部 AI への連携を切った目標は、AI からの書き込みも受け付けない。
    if not v_share then
      raise exception 'この目標は外部 AI との連携が無効です: %', v_goal_id;
    end if;

    -- 表題
    v_title := btrim(coalesce(v_item ->> 'title', ''));
    if length(v_title) = 0 then
      raise exception 'title は必須です。';
    end if;
    if length(v_title) > 160 then
      raise exception 'title が長すぎます（160 文字まで）。';
    end if;

    -- 理由
    v_why := nullif(btrim(coalesce(v_item ->> 'why', '')), '');
    if length(coalesce(v_why, '')) > 500 then
      raise exception 'why が長すぎます（500 文字まで）。';
    end if;

    -- 工数区分。XP 値はここでは受け取らない。
    v_effort := v_item ->> 'effort';
    if v_effort is null or v_effort not in ('S', 'M', 'L') then
      raise exception 'effort は S / M / L のいずれかです: %', coalesce(v_effort, '(未指定)');
    end if;

    -- 実施日。過去日は受け付けない。履歴を後から作れてしまうため。
    if (v_item ->> 'due_on') is null then
      v_due := public.app_today();
    else
      begin
        v_due := (v_item ->> 'due_on')::date;
      exception when others then
        raise exception 'due_on が日付ではありません: %', v_item ->> 'due_on';
      end;

      if v_due < public.app_today() then
        raise exception '過去の日付にはクエストを置けません: %', v_due;
      end if;
    end if;

    v_clean := v_clean || jsonb_build_object(
      'goal_id', v_goal_id,
      'title',   v_title,
      'why',     v_why,
      'effort',  v_effort,
      'due_on',  v_due
    );
  end loop;

  -- --- 1 日 3 枚の上限（D-1）--------------------------------------------
  -- 全目標を横断して数える。既存のクエストも含めて判定する。
  for v_day, v_adding in
    select (elem ->> 'due_on')::date, count(*)::integer
      from jsonb_array_elements(v_clean) as elem
     group by 1
  loop
    select count(*)::integer
      into v_existing
      from public.quests q
     where q.user_id = v_user
       and q.due_on = v_day;

    if v_existing + v_adding > k_daily_limit then
      raise exception
        '% の枠を超えます。1 日あたり % 枚までです（既存 % 枚、追加 % 枚）。',
        v_day, k_daily_limit, v_existing, v_adding;
    end if;
  end loop;

  -- --- 反映 ---------------------------------------------------------------
  return query
  with inserted as (
    insert into public.quests (user_id, goal_id, title, why, effort, due_on, generated_by)
    select
      v_user,
      (elem ->> 'goal_id')::uuid,
      elem ->> 'title',
      elem ->> 'why',
      (elem ->> 'effort')::public.quest_effort,
      (elem ->> 'due_on')::date,
      v_source
    from jsonb_array_elements(v_clean) as elem
    returning *
  )
  select * from inserted;
end;
$$;

comment on function public.propose_quests(jsonb) is
  'クエストの提案を受け取る。goal_id / title / why / effort / due_on のみを解釈し、'
  'XP 値は受け取らない。1 日あたり 3 枚の上限を全目標横断で強制する。';
