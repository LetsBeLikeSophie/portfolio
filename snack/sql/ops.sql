-- 운영용 SQL 모음 (Supabase SQL Editor에서 camtrip 프로젝트로 실행)

-- PIN 바꾸기 (사장님 = 통계까지, 직원 = 도장·재고만)
update snack.settings set admin_pin_hash = extensions.crypt('<새 사장님 PIN>', extensions.gen_salt('bf')) where id = 1;
update snack.settings set staff_pin_hash = extensions.crypt('<새 직원 PIN>', extensions.gen_salt('bf')) where id = 1;

-- 오픈 직전: 테스트 모드 끄기 (하루 1번 제한 켜짐). 페이지 CONFIG.testMode도 false로 같이!
update snack.settings set test_mode = false where id = 1;

-- 오픈 직전: 테스트하면서 쌓인 기록 지우기
delete from snack.draws;
delete from snack.visits;

-- 경품 확률·목록 바꾸기 (합계 100). 페이지 PRIZES 배열도 같이 맞춰야 화면 확률표가 맞아요
update snack.prizes set pct = 15 where tier = '4등';
update snack.prizes set items = array['고구마라떼 1잔','녹차라떼 1잔','딸기라떼 1잔','복숭아 아이스티 1잔','레모네이드 1잔','샌드위치','핫도그'] where tier = '5등';

-- 자료 뽑기: 날짜별 요약
select day, count(*) draws, count(distinct device) players,
       count(*) filter (where tier <> '꽝') wins, count(*) filter (where used) used
from snack.draws group by day order by day;
