-- ---------------------------------------------------------------------------
-- 目標ごとの「現在地」を持たせる。
--
-- AI が見られるのは Tasquest を使い始めてからの情報に限られる。使う前の経緯、
-- 今の習熟度、時間や道具の制約は記録から読み取れないため、最初のうちは
-- 手掛かりが乏しいまま提案することになる。これを人が書いて補う。
--
-- 既存の列との役割の違い:
--   why        なぜやるのか（動機）。ほぼ変わらない
--   background 今どこにいるのか（現在地・制約・経緯）。折に触れて書き換える
--   logs       何があったか（出来事）。日々積み上がる
--
-- background は追記型にしない。追記にすると logs と役割が重なり、
-- どちらに書くか迷う。現在地が変わったら上書きする 1 枚の文章とする。
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1. 書き手の区別
-- ===========================================================================

create type public.content_author as enum ('user', 'cowork', 'gemini');

comment on type public.content_author is
  '内容を最後に書いた主体。人と AI の共同編集を前提とするため、'
  '上書きを禁じるのではなく、誰がいつ書いたかを残して判断できるようにする。';


-- ===========================================================================
-- 2. 列の追加
-- ===========================================================================

alter table public.goals
  add column background            text
    check (length(background) <= 2000),
  add column background_updated_at timestamptz,
  add column background_updated_by public.content_author not null default 'user';

comment on column public.goals.background is
  'この目標における現在地。習熟度、これまでの経緯、時間や道具の制約など。'
  'AI への入力として使う。2000 文字までとし、プロンプトが膨らみすぎないようにする。';


-- ===========================================================================
-- 3. 更新時刻の自動記録
--
-- 呼び出し側に時刻の設定を委ねると、書き忘れたぶんだけ「いつの情報か」が
-- 分からなくなる。内容が変わったときに必ず刻む。
-- ===========================================================================

create or replace function public.stamp_background_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.background is distinct from old.background then
    new.background_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger goals_stamp_background
  before update on public.goals
  for each row
  execute function public.stamp_background_update();


-- ===========================================================================
-- 4. AI からの書き戻し
--
-- 人と AI で壁打ちした結果を保存する経路。propose_quests と同じく、
-- AI からの書き込みは RPC に限る（D-10）。
--
-- 上書きは禁じない。background は共同で育てる前提であり、
-- 章（goal_phases）のように編集を保護する対象ではないため。
-- 代わりに誰がいつ書いたかを残し、画面に出して判断できるようにする。
-- ===========================================================================

create or replace function public.record_background(
  p_goal_id    uuid,
  p_background text,
  p_source     text default 'cowork'
)
returns public.goals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_text   text := btrim(coalesce(p_background, ''));
  v_source public.content_author;
  v_share  boolean;
  v_goal   public.goals;
begin
  if v_user is null then
    raise exception 'ログインしていません。' using errcode = '28000';
  end if;

  if p_source not in ('cowork', 'gemini') then
    raise exception 'source は cowork か gemini のいずれかです。';
  end if;
  v_source := p_source::public.content_author;

  if length(v_text) = 0 then
    raise exception 'background が空です。消す場合は画面から操作してください。';
  end if;
  if length(v_text) > 2000 then
    raise exception 'background が長すぎます（2000 文字まで、現在 % 文字）。', length(v_text);
  end if;

  -- 所有者の確認。RLS により他人の行はそもそも見えない。
  select g.share_with_external_ai into v_share
    from public.goals g
   where g.id = p_goal_id;

  if not found then
    raise exception '目標が見つかりません: %', p_goal_id using errcode = 'P0002';
  end if;

  -- 外部 AI との連携を切った目標は、AI からの書き込みも受け付けない。
  if not v_share then
    raise exception 'この目標は外部 AI との連携が無効です: %', p_goal_id;
  end if;

  update public.goals
     set background            = v_text,
         background_updated_by = v_source
   where id = p_goal_id
  returning * into v_goal;

  return v_goal;
end;
$$;

comment on function public.record_background(uuid, text, text) is
  '壁打ちの結果をまとめた現在地を書き戻す。上書きは許すが、書き手と時刻を残す。';
