-- 20261122231909_snack_public_api_wrappers  (camtrip 프로젝트에 적용됨)
-- 데이터·로직은 snack 스키마에 두고, API 입구만 public에 snack_ 이름으로 둬요.
-- (snack 스키마를 대시보드 Exposed schemas에 추가하지 않고 쓰려고. camtrip이 쓰는 노출 목록을 건드리지 않기 위함)
create function public.snack_log_visit(p_device text, p_source text default 'link')
returns void language sql security invoker set search_path = ''
as $$ select snack.gacha_log_visit(p_device, p_source) $$;

create function public.snack_draw(p_device text)
returns json language sql security invoker set search_path = ''
as $$ select snack.gacha_draw(p_device) $$;

create function public.snack_redeem(p_code text, p_pin text)
returns json language sql security invoker set search_path = ''
as $$ select snack.gacha_redeem(p_code, p_pin) $$;

create function public.snack_get_stock()
returns json language sql stable security invoker set search_path = ''
as $$ select snack.gacha_get_stock() $$;

create function public.snack_set_stock(p_n int, p_pin text)
returns json language sql security invoker set search_path = ''
as $$ select snack.gacha_set_stock(p_n, p_pin) $$;

create function public.snack_stats(p_pin text)
returns json language sql stable security invoker set search_path = ''
as $$ select snack.gacha_stats(p_pin) $$;

revoke all on function public.snack_log_visit(text,text), public.snack_draw(text), public.snack_redeem(text,text),
  public.snack_get_stock(), public.snack_set_stock(int,text), public.snack_stats(text) from public;
grant execute on function public.snack_log_visit(text,text), public.snack_draw(text), public.snack_redeem(text,text),
  public.snack_get_stock(), public.snack_set_stock(int,text), public.snack_stats(text) to anon, authenticated;

notify pgrst, 'reload schema';
