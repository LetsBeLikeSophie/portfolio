-- 귓속말(DM): 같은 진영끼리만, 3일 보관, 차단 가능
-- 테이블은 RLS만 켜고 정책을 두지 않아 직접 읽을 수 없고, 아래 함수(토큰 확인)로만 다룬다.

alter table wow.players add column if not exists dm_key uuid not null default gen_random_uuid();

create table if not exists wow.dms (
  id bigint generated always as identity primary key,
  sender_id uuid not null references wow.players(id) on delete cascade,
  recipient_id uuid not null references wow.players(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  read_at timestamptz,
  check (sender_id <> recipient_id)
);
create index if not exists dms_sender on wow.dms (sender_id, id desc);
create index if not exists dms_recipient on wow.dms (recipient_id, id desc);
create index if not exists dms_unread on wow.dms (recipient_id, sender_id) where read_at is null;
create index if not exists dms_created on wow.dms (created_at);
alter table wow.dms enable row level security;
revoke all on wow.dms from anon, authenticated;

create table if not exists wow.blocks (
  blocker_id uuid not null references wow.players(id) on delete cascade,
  blocked_id uuid not null references wow.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists blocks_blocked on wow.blocks (blocked_id);
alter table wow.blocks enable row level security;
revoke all on wow.blocks from anon, authenticated;

-- 화면과 실시간 방송에 쓰는 한 건의 모양
create or replace function wow.dm_json(d wow.dms)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'sender_id', d.sender_id, 'recipient_id', d.recipient_id,
    'body', d.body, 'created_at', d.created_at, 'read_at', d.read_at,
    'sender_name', s.name, 'sender_class', s.class, 'sender_race', s.race, 'sender_faction', s.faction,
    'sender_level', s.level, 'sender_verified', s.verified, 'sender_realm', s.realm)
  from wow.players s where s.id = d.sender_id;
$$;
revoke all on function wow.dm_json(wow.dms) from public, anon, authenticated;

-- 내 귓속말을 받는 방송 주소 (주소 자체가 비밀 키)
create or replace function public.wow_dm_topic(p_token uuid)
returns text language sql stable security definer set search_path = '' as $$
  select 'wow-dm-' || dm_key from wow.players where token = p_token;
$$;

create or replace function public.wow_dm_send(p_token uuid, p_to uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_me wow.players; v_to wow.players; v_row wow.dms; v_json jsonb;
begin
  select * into v_me from wow.players where token = p_token for update;
  if not found then raise exception '캐릭터 정보가 없어요. 다시 입장해 주세요'; end if;
  if v_me.muted_until > now() then raise exception '신고가 여러 번 들어와서 잠시 채팅이 제한됐어요 (24시간)'; end if;
  select * into v_to from wow.players where id = p_to;
  if not found then raise exception '상대를 찾지 못했어요'; end if;
  if v_to.id = v_me.id then raise exception '나에게는 귓속말을 보낼 수 없어요'; end if;
  if v_to.faction is distinct from v_me.faction then raise exception '같은 진영에게만 귓속말을 보낼 수 있어요'; end if;
  if exists (select 1 from wow.blocks where blocker_id = v_me.id and blocked_id = v_to.id) then
    raise exception '차단한 사람이에요. 차단을 풀면 보낼 수 있어요';
  end if;
  if exists (select 1 from wow.blocks where blocker_id = v_to.id and blocked_id = v_me.id) then
    raise exception '귓속말을 보낼 수 없는 상대예요';
  end if;
  if v_me.last_sent_at is not null and v_me.last_sent_at > now() - interval '700 milliseconds' then
    raise exception '너무 빨라요! 잠깐만 기다려 주세요';
  end if;
  p_body := btrim(coalesce(p_body, ''));
  if char_length(p_body) < 1 then raise exception '메시지를 입력해 주세요'; end if;
  if char_length(p_body) > 300 then raise exception '300자까지 보낼 수 있어요'; end if;

  delete from wow.dms where created_at < now() - interval '3 days';

  insert into wow.dms (sender_id, recipient_id, body) values (v_me.id, v_to.id, p_body) returning * into v_row;
  update wow.players set last_sent_at = now() where id = v_me.id;

  v_json := wow.dm_json(v_row);
  perform realtime.send(v_json, 'dm', 'wow-dm-' || v_to.dm_key, false);
  perform realtime.send(v_json, 'dm', 'wow-dm-' || v_me.dm_key, false);
  return v_row.id;
end; $$;

-- 대화 목록: 상대별 마지막 글과 안 읽은 수 (내가 차단한 상대는 빼기)
create or replace function public.wow_dm_list(p_token uuid)
returns table(other_id uuid, other_name text, other_class text, other_race text, other_faction text,
  other_level integer, other_verified boolean, other_realm text,
  last_body text, last_at timestamptz, last_from_me boolean, unread integer)
language sql stable security definer set search_path = '' as $$
  with me as (select id from wow.players where token = p_token),
  d as (
    select x.id, x.body, x.created_at, x.read_at, x.sender_id = me.id as mine,
      case when x.sender_id = me.id then x.recipient_id else x.sender_id end as other
    from wow.dms x join me on x.sender_id = me.id or x.recipient_id = me.id
    where x.created_at > now() - interval '3 days'),
  last as (select distinct on (other) other, body, created_at, mine from d order by other, id desc),
  un as (select other, count(*)::integer as n from d where not mine and read_at is null group by other)
  select p.id, p.name, p.class, p.race, p.faction, p.level, p.verified, p.realm,
    l.body, l.created_at, l.mine, coalesce(un.n, 0)
  from last l
  join wow.players p on p.id = l.other
  join me on true
  left join un on un.other = l.other
  where not exists (select 1 from wow.blocks b where b.blocker_id = me.id and b.blocked_id = l.other)
  order by l.created_at desc
  limit 50;
$$;

-- 한 사람과의 대화 (열면 읽음 처리)
create or replace function public.wow_dm_thread(p_token uuid, p_with uuid, p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid; v jsonb;
begin
  select id into v_me from wow.players where token = p_token;
  if v_me is null then raise exception '캐릭터 정보가 없어요. 다시 입장해 주세요'; end if;
  update wow.dms set read_at = now() where recipient_id = v_me and sender_id = p_with and read_at is null;
  select coalesce(jsonb_agg(wow.dm_json(s.x) order by (s.x).id), '[]'::jsonb) into v
  from (
    select x from wow.dms x
    where ((x.sender_id = v_me and x.recipient_id = p_with) or (x.sender_id = p_with and x.recipient_id = v_me))
      and x.created_at > now() - interval '3 days'
    order by x.id desc
    limit least(greatest(coalesce(p_limit, 100), 1), 200)
  ) s;
  return v;
end; $$;

create or replace function public.wow_dm_read(p_token uuid, p_with uuid)
returns void language sql security definer set search_path = '' as $$
  update wow.dms set read_at = now()
  where recipient_id = (select id from wow.players where token = p_token) and sender_id = p_with and read_at is null;
$$;

create or replace function public.wow_block(p_token uuid, p_player uuid, p_on boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_me uuid;
begin
  select id into v_me from wow.players where token = p_token;
  if v_me is null then raise exception '캐릭터 정보가 없어요. 다시 입장해 주세요'; end if;
  if p_player is null or p_player = v_me then raise exception '나는 차단할 수 없어요'; end if;
  if not exists (select 1 from wow.players where id = p_player) then raise exception '상대를 찾지 못했어요'; end if;
  if p_on then
    insert into wow.blocks (blocker_id, blocked_id) values (v_me, p_player) on conflict do nothing;
  else
    delete from wow.blocks where blocker_id = v_me and blocked_id = p_player;
  end if;
  return p_on;
end; $$;

create or replace function public.wow_blocked(p_token uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select b.blocked_id from wow.blocks b join wow.players p on p.id = b.blocker_id where p.token = p_token;
$$;
