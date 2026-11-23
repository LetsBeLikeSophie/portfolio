-- 20261123_snack_gold_joke_result  (camtrip 프로젝트에 적용됨)
-- 황금: 1등처럼 요란하게 터지지만 아무 일도 없는 재미용 결과 (쿠폰 없음). 꽝 40% → 39%, 황금 1%
update snack.prizes set pct = 39, sort = 7 where tier = '꽝';
insert into snack.prizes (tier, name, pct, items, sort) values ('황금','황금 캐릭터',1,null,6);
-- gacha_redeem: tier in ('꽝','황금')이면 "쓸 수 있는 쿠폰이 아니에요"
-- gacha_stats: wins = tier not in ('꽝','황금')
-- (함수 전체는 01 파일과 같고 위 두 줄만 바뀜. 서버에는 create or replace로 적용함)
