-- 20261123_snack_admin_history  (camtrip 프로젝트 ztxzqvnybiemgbhtrwiw 에 적용됨)
-- 사장님 화면: 기간별 뽑기 이력 + 확률표, 쿠폰 번호로 찾기 (사장님 PIN만)

create function snack.gacha_history(p_pin text, p_from date, p_to date)
returns json language plpgsql stable security definer set search_path = ''
as $$
declare v json;
begin
  if snack._pin_role(p_pin) is distinct from 'admin' then raise exception 'PIN이 틀렸어요'; end if;
  select json_build_object(
    'prizes', (select json_agg(json_build_object('tier',tier,'name',name,'pct',pct) order by sort) from snack.prizes),
    'rows', coalesce((select json_agg(r order by r.id desc) from (
        select id, day, tier, prize, code, used, used_at, created_at
        from snack.draws
        where day between coalesce(p_from, '2000-01-01') and coalesce(p_to, '2999-12-31')
        order by id desc limit 2000) r), '[]'::json)
  ) into v;
  return v;
end $$;

create function snack.gacha_lookup(p_code text, p_pin text)
returns json language plpgsql stable security definer set search_path = ''
as $$
declare v_d snack.draws;
begin
  if snack._pin_role(p_pin) is distinct from 'admin' then raise exception 'PIN이 틀렸어요'; end if;
  select * into v_d from snack.draws where code = upper(trim(p_code));
  if not found then return json_build_object('found',false); end if;
  return json_build_object('found',true,'day',v_d.day,'tier',v_d.tier,'prize',v_d.prize,'code',v_d.code,
    'used',v_d.used,'used_at',v_d.used_at,'created_at',v_d.created_at,'today',v_d.day = snack._today());
end $$;

revoke all on function snack.gacha_history(text,date,date), snack.gacha_lookup(text,text) from public, anon, authenticated;
grant execute on function snack.gacha_history(text,date,date), snack.gacha_lookup(text,text) to anon, authenticated;

create function public.snack_history(p_pin text, p_from date default null, p_to date default null)
returns json language sql stable security invoker set search_path = ''
as $$ select snack.gacha_history(p_pin, p_from, p_to) $$;

create function public.snack_lookup(p_code text, p_pin text)
returns json language sql stable security invoker set search_path = ''
as $$ select snack.gacha_lookup(p_code, p_pin) $$;

revoke all on function public.snack_history(text,date,date), public.snack_lookup(text,text) from public;
grant execute on function public.snack_history(text,date,date), public.snack_lookup(text,text) to anon, authenticated;

notify pgrst, 'reload schema';
