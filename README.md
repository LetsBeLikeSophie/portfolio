# portfolio

[itssophie.dev](https://itssophie.dev)에서 서빙되는 개인 포트폴리오 홈페이지입니다.
빌드 도구 없이 바닥부터 짠 정적 페이지 한 장으로, 진행 중인 프로젝트들을 목록으로 소개하고
각 프로젝트로 연결합니다.

## 구성

- `src/template.html` — 페이지 디자인 (마크업 + 스타일 + 스크립트)
- `src/projects.json` — 프로젝트 목록. 모든 페이지가 이 파일 하나를 공유함
- `src/pages/*.json` — 페이지별 설정 (소개 문장, 프로젝트 순서, 회사별 강조 문구). `main.json`은 루트 주소에 어떤 페이지를 보여줄지만 정함
- `build.py` — 위 파일로 페이지를 만드는 스크립트 (외부 패키지 없음)
- `index.html`, `<회사>/index.html` — `build.py`가 만든 결과물. 직접 고치지 말고 `src`를 고친 뒤 다시 빌드

라이트/다크 테마는 시스템의 `prefers-color-scheme`을 따르고, 우측 상단 스위치로 바꿀 수 있습니다.
선택한 테마는 `localStorage`에 저장됩니다.

```bash
python3 build.py
```

## 회사별 페이지

지원하는 회사마다 `itssophie.dev/<회사>/` 페이지를 따로 둘 수 있습니다. 디자인과 프로젝트 내용은
메인과 같고, 소개 문장·순서·공고와 닿는 부분만 다르게 보여줍니다.

1. `src/pages/hybe.json`을 복사해서 `src/pages/<회사>.json`을 만들고 내용을 바꿉니다.
   - `slug`: 주소에 쓸 이름 (예: `hybe` → `/hybe/`)
   - `index`: 회사 페이지는 `false`로 둡니다. 검색엔진이 수집하지 않도록 `noindex` 태그가 들어갑니다.
   - `order`: 프로젝트 순서. 빠진 프로젝트는 원래 순서대로 뒤에 붙습니다.
   - `notes`: 프로젝트 id별 "공고와 닿는 부분" 문구. 없는 프로젝트는 문구 없이 나옵니다.
   - `focus_stack`: 공고에 나온 기술. 그래프와 태그에 초록색으로 표시됩니다.
2. `python3 build.py`를 실행하면 `<회사>/index.html`이 생깁니다.

### 루트 주소(itssophie.dev/)에 무엇을 보여줄지

일반 포트폴리오는 `src/pages/home.json` → `itssophie.dev/home/`에 있습니다.
루트 주소는 `src/pages/main.json`의 `extends` 값에 적힌 페이지를 그대로 보여줍니다.

- 평소: `"extends": "home"` → 루트에 일반 포트폴리오 (검색 허용)
- 이미 제출한 이력서에 루트 주소만 적혀 있을 때: `"extends": "<회사>"` → 루트에 그 회사 페이지.
  검색 차단도 회사 페이지 설정을 따라가서 링크로 들어온 사람만 보게 됩니다.

값을 바꾼 뒤 `python3 build.py`를 실행하고 루트 `index.html`을 다시 배포하면 됩니다.

회사 페이지는 메인에서 링크하지 않고, `robots.txt`에도 적지 않습니다. 적어두면 그 자체로 경로가
공개되기 때문입니다. 지원서에 주소를 직접 넣어서 전달합니다.

## 배포

`index.html`을 서버의 `/var/www/portfolio/index.html`로 그대로 올리는 방식으로 배포합니다.
nginx가 `itssophie.dev` 루트(`/`)에서 이 파일을 서빙하고, `/tablelink/` 경로는 별도로
[TableLink](https://github.com/LetsBeLikeSophie/TableLink) 앱으로 라우팅합니다.

GitHub에 푸시해도 사이트에는 자동으로 반영되지 않으므로, 빌드하고 푸시한 뒤 아래 순서로 서버 파일을 교체합니다.

### 메인 페이지

1. `index.html`을 서버의 임시 경로로 복사합니다.

   ```bash
   scp -i <SSH 키 파일> index.html ubuntu@<서버 IP>:/tmp/portfolio-index.html
   ```

2. 기존 파일을 백업한 뒤 새 파일로 교체합니다. 파일 소유자는 nginx가 읽을 수 있도록 `www-data`로 맞춥니다.

   ```bash
   ssh -i <SSH 키 파일> ubuntu@<서버 IP> "cd /var/www/portfolio && sudo cp index.html index.html.bak-\$(date +%Y%m%d%H%M%S) && sudo install -o www-data -g www-data -m 644 /tmp/portfolio-index.html index.html && rm /tmp/portfolio-index.html"
   ```

3. 사이트에 반영됐는지 확인합니다. nginx는 정적 파일을 바로 읽으므로 재시작할 필요가 없습니다.

   ```bash
   curl -s https://itssophie.dev/ | grep "<새로 추가한 프로젝트 이름>"
   ```

### 회사별 페이지와 /home

`<회사>`를 `slug` 값(`home`, `hybe` 등)으로 바꿔서 실행합니다. 폴더가 없으면 새로 만들어집니다.

```bash
scp -i <SSH 키 파일> <회사>/index.html ubuntu@<서버 IP>:/tmp/portfolio-<회사>.html
ssh -i <SSH 키 파일> ubuntu@<서버 IP> "sudo install -d -o www-data -g www-data /var/www/portfolio/<회사> && sudo install -o www-data -g www-data -m 644 /tmp/portfolio-<회사>.html /var/www/portfolio/<회사>/index.html && rm /tmp/portfolio-<회사>.html"
curl -s https://itssophie.dev/<회사>/ | grep noindex
```

회사 페이지는 마지막 줄에서 `noindex`가 보이면 검색 차단 태그까지 정상으로 올라간 것입니다. (`home`은 검색 허용이라 아무것도 안 나오는 게 정상입니다.)

### 되돌리기

백업은 같은 폴더에 `index.html.bak-<날짜시간>` 이름으로 쌓입니다. 이전 버전으로 돌아가려면 원하는 백업을 다시 `index.html`로 복사합니다.

```bash
ssh -i <SSH 키 파일> ubuntu@<서버 IP> "cd /var/www/portfolio && ls index.html.bak-* && sudo install -o www-data -g www-data -m 644 index.html.bak-<날짜시간> index.html"
```

## 프로젝트 추가하기

`src/projects.json`의 `projects`에 항목 하나를 추가하고 `python3 build.py`를 실행합니다.
`group`은 `public`(공개 중) 또는 `building`(만드는 중), `state`는 `live`·`released`·`building` 중 하나입니다.
`state`와 별개로 표시할 상태가 있으면 `badge`에 적습니다 (예: `"badge": "앱 심사 중"`). 빼면 표시되지 않습니다.
모든 페이지에 한 번에 반영되고, 회사별 페이지에서는 `order`에 없으면 뒤에 붙습니다.

## 포에버 채팅 (`/forever/`)

`forever/index.html`은 와우 포에버 실시간 채팅 페이지입니다. `build.py`와 상관없는 독립 파일이라 직접 고칩니다.
데이터는 Supabase(camtrip 프로젝트의 `wow` 스키마)에 있고, 캐릭터 조회는 Edge Function `wow-character`가 블리자드 API로 처리합니다.

## 오늘간식 뽑기 (`snack.itssophie.dev`)

`snack/index.html`은 가게(오늘간식) 매장 QR 뽑기 페이지입니다. `build.py`와 상관없는 독립 파일입니다.
데이터는 Supabase(camtrip 프로젝트의 `snack` 스키마)에 있고, 페이지는 `public.snack_*` 함수로만 접근합니다.

- 매장 QR 주소: `https://snack.itssophie.dev/#qr` (끝의 `#qr`로 QR 방문과 링크 방문을 나눠 셉니다)
- 사장님 화면: `https://snack.itssophie.dev/#admin`
- 오픈 전 테스트 모드: 페이지의 `CONFIG.testMode`와 서버의 `snack.settings.test_mode`를 둘 다 `false`로 바꾸면 하루 1번 제한이 걸립니다.

서버에 올리는 방법은 위 회사별 페이지와 같고, 서브도메인이라 nginx 설정과 인증서가 한 번 필요합니다.

```bash
scp -i <SSH 키 파일> snack/index.html ubuntu@<서버 IP>:/tmp/snack-index.html
ssh -i <SSH 키 파일> ubuntu@<서버 IP> "sudo install -d -o www-data -g www-data /var/www/snack && sudo install -o www-data -g www-data -m 644 /tmp/snack-index.html /var/www/snack/index.html && rm /tmp/snack-index.html"
```

## QR 카드 (`/qr/`)

`qr/index.html`은 와이파이·링크·연락처(vCard)·전화·문자·글을 QR 카드로 만들어주는 페이지입니다. `build.py`와 상관없는 독립 파일입니다.
QR 생성은 같은 폴더의 `qr/qrcode.js`([qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) 1.4.4, MIT)로
브라우저 안에서 하고, 서버로 아무것도 보내지 않습니다.

- 카드 스타일 5가지(깔끔·티켓·포스트잇·크라프트·밤하늘), QR 색, 점 모양(네모·둥글게·점), 가운데(비우기·용도 아이콘·사진), 카드 제목
- 가운데를 채우면 오류 정정을 H로 올리고, 내용이 길어 안 들어가면 가운데를 빼고 만듭니다
- "카드" 또는 "QR만"으로 저장·복사·공유. 아이폰은 저장 버튼이 공유 시트를 띄워서 사진첩에 바로 넣을 수 있습니다
- 입력 내용과 꾸미기 설정은 `localStorage`에 남지만 와이파이 비밀번호는 저장하지 않습니다
- 와이파이 모드의 "공유기 사진으로 채우기": 공유기 뒷면 라벨 사진에서 와이파이 이름과 비밀번호를 읽어 채웁니다.
  글자 인식은 `qr/ocr/`에 같이 둔 [tesseract.js](https://github.com/naptha/tesseract.js) 5.1.1(Apache-2.0)과
  영어·한국어 학습 데이터(`4.0.0_best_int`)로 브라우저 안에서 하고, 사진은 서버로 보내지 않습니다.
  사진을 고르면 바로 읽지 않고, 사용자가 돌리기로 바로 세우고 네모(모서리 끌기·안쪽 끌어 이동)로 이름·비밀번호 부분만 잡은 뒤
  "이 부분 읽기"를 눌러야 그 부분만 잘라 읽습니다. 네모를 맞추는 동안 글자 인식 엔진을 미리 받아 둡니다.
  처음 사진을 고를 때만 엔진과 학습 데이터(약 10MB)를 받습니다. PC에서는 사진을 붙여넣거나 끌어다 놓아도 됩니다.

```bash
scp -i <SSH 키 파일> -r qr ubuntu@<서버 IP>:/tmp/portfolio-qr
ssh -i <SSH 키 파일> ubuntu@<서버 IP> "sudo rm -rf /var/www/portfolio/qr && sudo cp -r /tmp/portfolio-qr /var/www/portfolio/qr && sudo chown -R www-data:www-data /var/www/portfolio/qr && rm -rf /tmp/portfolio-qr"
```

nginx(`itssophie.dev` 설정)에서 `/qr/`은 `no-cache`, `/qr/ocr/`은 30일 캐시이고, `.gz` 학습 데이터는 다시 압축하지 않습니다(2026-11-24).
`qr/ocr/` 안의 파일을 바꿀 때는 30일 캐시 때문에 파일 이름을 바꿔야 바로 반영됩니다.
`/qr/`에는 CSP가 걸려 있어서 페이지는 자기 서버(`'self'`)와 구글 폰트 말고는 아무 데도 연결하지 못합니다.
바깥 스크립트·API를 새로 쓰려면 nginx의 `Content-Security-Policy`에 그 주소를 먼저 넣어야 합니다.
