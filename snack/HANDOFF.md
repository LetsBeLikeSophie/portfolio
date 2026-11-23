# 오늘간식 뽑기: 인수인계 메모

> 클라우드 세션(2026-11-22~23)에서 만든 것. 데스크톱 세션은 여기서 이어서 하면 돼요.
> 브랜치: `claude/focused-heisenberg-sxcn0l` (main에는 아직 안 합침)

## 한 줄 요약

매장 QR을 찍으면 일력(하루 한 장 뜯는 달력)을 뜯어 간식 쿠폰을 뽑는 페이지. 직원이 도장(PIN)을 찍으면 사용 처리.
데이터는 Supabase **camtrip** 프로젝트의 **`snack` 스키마**. 배포 주소는 **`snack.itssophie.dev`** (아직 서버에 안 올림).

## 지금 상태

| 항목 | 상태 |
|---|---|
| 페이지 `snack/index.html` | 완성. 서버 연결 코드 들어감 |
| Supabase `snack` 스키마 | 적용 완료, DB 안에서 테스트 통과 (뽑기·도장·PIN·통계) |
| 페이지 → Supabase 실제 연결 | **미확인**. 클라우드 세션에서 supabase.co 접속이 막혀서 못 해봄. 배포 후 꼭 확인 |
| 서버 배포 (snack.itssophie.dev) | **안 함**. SSH 키가 데스크톱에만 있음 |
| 미리보기 (claude.ai 아티팩트) | https://claude.ai/artifact/7eUT2TpG8BXztDY9bJYSkZ (claude.ai는 외부 서버 호출을 막아서 항상 미리보기 모드로 돌아감) |
| 브랜드·디자인 정리 문서 | https://claude.ai/artifact/X9hhCBxuLt6SYJY7DcSfCi |

## 데스크톱에서 할 일 (순서대로)

1. **브랜치 받기**: `git fetch origin claude/focused-heisenberg-sxcn0l && git checkout claude/focused-heisenberg-sxcn0l`
   (main에 합칠지는 사장님 판단. 다른 기능 브랜치처럼 `Merge branch ...`로 합치면 됨)
2. **DNS**: 도메인 관리하는 곳에서 `A` 레코드 `snack` → itssophie.dev와 같은 서버 IP
3. **파일 올리기**
   ```bash
   scp -i <SSH 키> snack/index.html ubuntu@<서버 IP>:/tmp/snack-index.html
   ssh -i <SSH 키> ubuntu@<서버 IP> "sudo install -d -o www-data -g www-data /var/www/snack && sudo install -o www-data -g www-data -m 644 /tmp/snack-index.html /var/www/snack/index.html && rm /tmp/snack-index.html"
   ```
4. **nginx**: `/etc/nginx/sites-available/snack`
   ```nginx
   server {
       listen 80;
       server_name snack.itssophie.dev;
       root /var/www/snack;
       index index.html;
       location / { try_files $uri $uri/ /index.html; }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/snack /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. **https**: DNS 반영 뒤 `sudo certbot --nginx -d snack.itssophie.dev`
6. **연결 확인**: `https://snack.itssophie.dev/#qr` 열기 → 위에 "서버에 연결이 안 돼서 미리보기 모드" 띠가 **안 뜨면** 성공.
   뽑기 → 쿠폰 귀퉁이 도장 → 직원 PIN → "사용완료" → `#admin`에서 사장님 PIN으로 숫자 올라갔는지 확인
7. **매장 QR 이미지 만들기**: 주소는 `https://snack.itssophie.dev/#qr` (끝의 `#qr`이 QR 방문 집계용)

> 대안: 서브도메인 대신 `itssophie.dev/snack/`으로 두면 2·4·5번이 필요 없음 (파일만 `/var/www/portfolio/snack/index.html`로). 그때는 `index.html`의 `og:url`도 바꾸기.

## 오픈(12월 8일 화) 전에 꼭

- [ ] 테스트 모드 끄기: **두 군데 다**
  - 페이지 `snack/index.html`의 `CONFIG.testMode: false`
  - 서버 `update snack.settings set test_mode = false where id = 1;`
- [ ] 테스트 기록 지우기: `snack/sql/ops.sql` 참고 (`delete from snack.draws; delete from snack.visits;`)
- [ ] 핫도그가 오픈 때 메뉴에 있는지 확인. 없으면 1등(핫도그 1개 무료)이랑 5등 목록에서 빼야 함 (페이지 `PRIZES` + DB `snack.prizes` 둘 다)
- [ ] 영업시간 정해지면 `CONFIG.openHour/closeHour` 채우기. 지금은 비어 있어서 3시 이후 할인 띠가 밤새 떠 있음
- [ ] (선택) 정확한 주소·지도 링크: `CONFIG.address`, `CONFIG.mapUrl`

## 정해진 것 (사장님과 합의)

- **매장·포장 전용**. 배민 연동은 안 함 (배민에서 우리 코드로 결제 금액을 깎을 방법이 없음 → 배달은 배민 가게쿠폰을 따로 운영)
- 쿠폰은 **뽑은 날 하루만**. 직원이 **쿠폰 귀퉁이 동그란 도장** → PIN → "사용완료" 쾅
- 쿠폰 번호는 화면 아래 작게 `No. XXXXXX` (문의·연결 끊김 대비). 캡처 방지는 실시간 시계로
- 뜯기 전에는 빛·색 힌트 없음. 결과는 뜯은 뒤에만 (1등: 금색 띠·별·꽃가루 / 꽝: 회색 떡볶이 + "꽝!" 떨어짐)
- 위치 문구: "남부시장 근처". "원주" 알약은 뺌 (손님이 다 원주 사람)

## 경품 (합계 100%)

| 등수 | 경품 | 확률 | 캐릭터 |
|---|---|---|---|
| 1등 | 핫도그 1개 무료 | 1% | 핫도그 |
| 2등 | 음료 1+1 (같은 음료로만) | 3% | 커피 |
| 3등 | 샌드위치 사면 아메리카노 무료 | 8% | 커피 |
| 4등 | 음료 1잔 500원 할인 | 15% | 커피 |
| 5등 | 메뉴 하나 500원 할인 (긁어서 확인) | 33% | 긁기 전 타코야끼 → 음료면 커피, 핫도그면 핫도그, 샌드위치면 타코야끼 그대로 |
| 황금 | 아무것도 없음 (재미용) | 1% | 황금 커피·핫도그·떡볶이·타코야끼 중 하나. 1등처럼 다 터지고 잠시 뒤 "…그뿐. 아무 일도 일어나지 않았어요" |
| 꽝 | — | 39% | 회색 떡볶이 |

5등 목록: 고구마라떼·녹차라떼·딸기라떼·복숭아 아이스티·레모네이드 1잔, 샌드위치, 핫도그.
일부러 "있어도 안 쓸 것 같은" 결과도 섞음 (뽑는 재미용).

**경품을 바꿀 때는 두 군데를 같이**: 페이지 `PRIZES`(화면 확률표·라벨) + DB `snack.prizes`(실제 뽑기). 실제 결과는 서버가 정함.

## Supabase 구조 (camtrip 프로젝트 `ztxzqvnybiemgbhtrwiw`)

- `snack.settings`: PIN 해시(사장님/직원), `test_mode`, 샌드위치 재고
- `snack.prizes`: 경품표
- `snack.visits`: 하루·폰당 1줄, `source`가 `qr`/`link`
- `snack.draws`: 뽑기 1번당 1줄 (등수·경품·메뉴·코드·사용 여부·사용 시각)
- 테이블은 RLS on + 정책 없음 → 바깥에서 직접 못 읽음
- 페이지는 `public.snack_*` 함수 6개로만 접근 (`snack_log_visit`, `snack_draw`, `snack_redeem`, `snack_get_stock`, `snack_set_stock`, `snack_stats`).
  `snack` 스키마를 대시보드 Exposed schemas에 넣지 않으려고 public에 얇은 입구만 둠 (camtrip의 노출 목록을 안 건드리려고)
- SQL 원본: `snack/sql/01_*.sql`, `02_*.sql` (PIN은 `<ADMIN_PIN>` 자리표시자로 가림), 운영용은 `snack/sql/ops.sql`
- **PIN**: 사장님용 / 직원용 두 개. 값은 저장소에 안 적음 (사장님이 알고 있음). 사장님 PIN만 통계를 볼 수 있음
- 페이지에 들어간 키는 공개용 publishable key라 노출돼도 괜찮음

## 사장님 화면 (`#admin`)

오늘 / 오픈부터 지금까지: 방문(QR 따로), 뽑은 사람(참여율), 쿠폰 사용/당첨, **사용률**(= 도장 찍힌 쿠폰 ÷ 당첨, 꽝 제외).
경품별·날짜별 표, "자료 복사" 버튼 (엑셀·구글시트에 붙여넣기용 탭 구분).
손님 화면에는 사장님 링크가 없음. 주소에 `#admin` 붙여서 즐겨찾기.

## 나중에 할 것 (아이디어)

- 사장님 화면을 PIN 대신 **엄마 계정 로그인**(허용된 이메일만)으로 바꾸기
- 메뉴 늘면(회오리감자·요거트·찹쌀떡) 5등 목록에 추가
- 꽝/4~5등에 "3일 안에 다시 오면" 같은 재방문 유도 (논의만 함)

## 파일

- `snack/index.html`: 배포용 완성 파일 (이것 하나만 서버에 올리면 됨)
- `snack/assets/`: 간판 원본 PDF(3200×1000mm, 벡터)와 거기서 잘라낸 캐릭터·로고 SVG, 황금 버전(`*_gold.svg`, 색만 금색으로) (페이지에는 인라인으로 들어가 있음)
- `snack/preview/`: 현재 화면 캡처 (첫 화면, 1등, 꽝, 5등 긁기 전, 도장 찍은 뒤, 사장님 화면)
- `snack/sql/`: 위 설명
