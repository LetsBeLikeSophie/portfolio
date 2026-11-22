-- 20261122231226_snack_gacha_init  (camtrip 프로젝트 ztxzqvnybiemgbhtrwiw 에 적용됨)
-- 오늘간식 뽑기: camtrip 프로젝트 안의 독립 스키마
-- ※ PIN 값은 저장소에 남기지 않으려고 <ADMIN_PIN>/<STAFF_PIN>으로 바꿔 뒀어요. 실제 PIN은 사장님이 알고 있어요.
create schema if not exists snack;

create table snack.settings (
  id int primary key default 1 check (id = 1),
  admin_pin_hash text not null,
  staff_pin_hash text not null,
  test_mode boolean not null default true,   -- true면 같은 사람이 하루 여러 번 뽑기 가능 (오픈 전 테스트용)
  stock_n int,
  stock_day date
);

create table snack.prizes (
  tier text primary key,
  name text not null,           -- {item} 자리에 items 중 하나가 들어가요
  pct numeric not null check (pct >= 0),
  items text[],
  sort int not null
);

create table snack.visits (
  day date not null,
  device text not null,
  source text not null default 'link' check (source in ('qr','link')),
  first_at timestamptz not null default now(),
  primary key (day, device)
);

create table snack.draws (
  id bigint generated always as identity primary key,
  day date not null,
  device text not null,
  tier text not null,
  prize text not null,
  item text,
  code text not null unique,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index draws_day_idx on snack.draws (day);
create index draws_device_day_idx on snack.draws (device, day);

alter table snack.settings enable row level security;
alter table snack.prizes   enable row level security;
alter table snack.visits   enable row level security;
alter table snack.draws    enable row level security;
-- 정책 없음 = 바깥(anon)에서 테이블 직접 접근 불가. 아래 함수로만 접근해요.

insert into snack.settings (admin_pin_hash, staff_pin_hash)
values (extensions.crypt('<ADMIN_PIN>', extensions.gen_salt('bf')), extensions.crypt('<STAFF_PIN>', extensions.gen_salt('bf')));

insert into snack.prizes (tier, name, pct, items, sort) values
 ('1등','핫도그 1개 무료',1,null,1),
 ('2등','음료 1+1',3,null,2),
 ('3등','샌드위치 사면 아메리카노 무료',8,null,3),
 ('4등','음료 1잔 500원 할인',15,null,4),
 ('5등','{item} 500원 할인',33,array['고구마라떼 1잔','녹차라떼 1잔','딸기라떼 1잔','복숭아 아이스티 1잔','레모네이드 1잔','샌드위치','핫도그'],5),
 ('꽝','꽝',40,null,6);

create function snack._today() returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Asia/Seoul')::date $$;

create function snack._pin_role(p_pin text) returns text language sql stable security definer set search_path = ''
as $$
  select case
    when p_pin is null then null
    when s.admin_pin_hash = extensions.crypt(p_pin, s.admin_pin_hash) then 'admin'
    when s.staff_pin_hash = extensions.crypt(p_pin, s.staff_pin_hash) then 'staff'
  end from snack.settings s where s.id = 1
$$;

create function snack.gacha_log_visit(p_device text, p_source text default 'link')
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_device is null or length(p_device) > 80 then return; end if;
  insert into snack.visits(day, device, source)
  values (snack._today(), p_device, case when p_source = 'qr' then 'qr' else 'link' end)
  on conflict (day, device) do update
    set source = case when excluded.source = 'qr' then 'qr' else snack.visits.source end;
end $$;

create function snack.gacha_draw(p_device text)
returns json language plpgsql security definer set search_path = ''
as $$
declare
  v_today date := snack._today();
  v_test boolean;
  v_ex snack.draws;
  v_p snack.prizes;
  v_r numeric;
  v_item text;
  v_code text;
  v_row snack.draws;
  v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if p_device is null or length(p_device) > 80 then raise exception 'bad device'; end if;
  select test_mode into v_test from snack.settings where id = 1;

  if not v_test then
    select * into v_ex from snack.draws where device = p_device and day = v_today order by id limit 1;
    if found then
      return json_build_object('day',v_ex.day,'tier',v_ex.tier,'prize',v_ex.prize,'item',v_ex.item,'code',v_ex.code,'used',v_ex.used,'already',true);
    end if;
  end if;

  v_r := random() * (select sum(pct) from snack.prizes);
  for v_p in select * from snack.prizes order by sort loop
    exit when v_r < v_p.pct;
    v_r := v_r - v_p.pct;
  end loop;

  if v_p.items is not null and array_length(v_p.items,1) > 0 then
    v_item := v_p.items[1 + floor(random() * array_length(v_p.items,1))::int];
  end if;

  loop
    v_code := (select string_agg(substr(v_alpha, 1 + floor(random()*32)::int, 1), '') from generate_series(1,6));
    exit when not exists (select 1 from snack.draws where code = v_code);
  end loop;

  insert into snack.draws(day, device, tier, prize, item, code)
  values (v_today, p_device, v_p.tier, replace(v_p.name, '{item}', coalesce(v_item,'')), v_item, v_code)
  returning * into v_row;

  return json_build_object('day',v_row.day,'tier',v_row.tier,'prize',v_row.prize,'item',v_row.item,'code',v_row.code,'used',false);
end $$;

create function snack.gacha_redeem(p_code text, p_pin text)
returns json language plpgsql security definer set search_path = ''
as $$
declare v_d snack.draws;
begin
  if snack._pin_role(p_pin) is null then
    return json_build_object('ok',false,'reason','PIN이 틀렸어요');
  end if;
  select * into v_d from snack.draws where code = upper(p_code) for update;
  if not found then return json_build_object('ok',false,'reason','쿠폰을 찾을 수 없어요'); end if;
  if v_d.tier = '꽝' then return json_build_object('ok',false,'reason','꽝은 쓸 수 없어요'); end if;
  if v_d.used then return json_build_object('ok',false,'reason','이미 쓴 쿠폰이에요'); end if;
  if v_d.day <> snack._today() then return json_build_object('ok',false,'reason','오늘 뽑은 쿠폰만 쓸 수 있어요'); end if;
  update snack.draws set used = true, used_at = now() where id = v_d.id;
  return json_build_object('ok',true);
end $$;

create function snack.gacha_get_stock()
returns json language sql stable security definer set search_path = ''
as $$ select json_build_object('n', stock_n, 'day', stock_day) from snack.settings where id = 1 $$;

create function snack.gacha_set_stock(p_n int, p_pin text)
returns json language plpgsql security definer set search_path = ''
as $$
begin
  if snack._pin_role(p_pin) is null then raise exception 'PIN이 틀렸어요'; end if;
  update snack.settings set stock_n = greatest(0, p_n), stock_day = snack._today() where id = 1;
  return json_build_object('ok',true);
end $$;

create function snack.gacha_stats(p_pin text)
returns json language plpgsql stable security definer set search_path = ''
as $$
declare v json;
begin
  if snack._pin_role(p_pin) is distinct from 'admin' then raise exception 'PIN이 틀렸어요'; end if;
  with dv as (
    select day, count(*) visitors, count(*) filter (where source='qr') qr from snack.visits group by day
  ), dd as (
    select day, count(*) draws, count(distinct device) players,
           count(*) filter (where tier <> '꽝') wins, count(*) filter (where used) used
    from snack.draws group by day
  ), days as (
    select coalesce(dv.day, dd.day) as day,
           coalesce(visitors,0) visitors, coalesce(qr,0) qr, coalesce(players,0) players,
           coalesce(draws,0) draws, coalesce(wins,0) wins, coalesce(used,0) used
    from dv full join dd on dv.day = dd.day
  )
  select json_build_object(
    'total_visitors', (select count(distinct device) from snack.visits),
    'total', json_build_object(
       'visits', (select coalesce(sum(visitors),0) from days),
       'qr', (select coalesce(sum(qr),0) from days),
       'players', (select coalesce(sum(players),0) from days),
       'draws', (select coalesce(sum(draws),0) from days),
       'wins', (select coalesce(sum(wins),0) from days),
       'used', (select coalesce(sum(used),0) from days)),
    'days', coalesce((select json_agg(days order by day desc) from days), '[]'::json),
    'prizes', (select json_agg(json_build_object('tier',p.tier,'prize',p.name,
                 'drawn',(select count(*) from snack.draws d where d.tier=p.tier),
                 'used',(select count(*) from snack.draws d where d.tier=p.tier and d.used)) order by p.sort)
               from snack.prizes p)
  ) into v;
  return v;
end $$;

revoke all on all tables in schema snack from public, anon, authenticated;
revoke all on all functions in schema snack from public, anon, authenticated;
grant usage on schema snack to anon, authenticated, service_role;
grant execute on function
  snack.gacha_log_visit(text,text), snack.gacha_draw(text), snack.gacha_redeem(text,text),
  snack.gacha_get_stock(), snack.gacha_set_stock(int,text), snack.gacha_stats(text)
to anon, authenticated;
