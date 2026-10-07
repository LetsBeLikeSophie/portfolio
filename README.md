# portfolio

[itssophie.dev](https://itssophie.dev)에서 서빙되는 개인 포트폴리오 홈페이지입니다.
빌드 도구 없이 바닥부터 짠 정적 페이지 한 장으로, 진행 중인 프로젝트들을 목록으로 소개하고
각 프로젝트로 연결합니다.

## 구성

- `index.html` — 페이지 전체 (마크업 + 스타일 + 스크립트가 한 파일에 있음)
- 라이트/다크 테마: 기본은 시스템의 `prefers-color-scheme`을 따라가고, 우측 상단 스위치로
  수동 전환 가능. 선택한 테마는 `localStorage`에 저장되어 다음 방문에도 유지됨
- 프레임워크나 빌드 스텝 없음 — 정적 파일 그대로 서버에 올려서 서빙

## 배포

`index.html`을 서버의 `/var/www/portfolio/index.html`로 그대로 올리는 방식으로 배포합니다.
nginx가 `itssophie.dev` 루트(`/`)에서 이 파일을 서빙하고, `/tablelink/` 경로는 별도로
[TableLink](https://github.com/LetsBeLikeSophie/TableLink) 앱으로 라우팅합니다.

GitHub에 푸시해도 사이트에는 자동으로 반영되지 않으므로, 푸시한 뒤 아래 순서로 서버 파일을 교체합니다.

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

### 되돌리기

백업은 같은 폴더에 `index.html.bak-<날짜시간>` 이름으로 쌓입니다. 이전 버전으로 돌아가려면 원하는 백업을 다시 `index.html`로 복사합니다.

```bash
ssh -i <SSH 키 파일> ubuntu@<서버 IP> "cd /var/www/portfolio && ls index.html.bak-* && sudo install -o www-data -g www-data -m 644 index.html.bak-<날짜시간> index.html"
```

## 프로젝트 추가하기

`index.html`의 `.projects` 안에 `.card` 하나를 추가하면 됩니다. 아직 배포 전인 프로젝트는
`.card.disabled`로 표시합니다.
