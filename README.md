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

## 프로젝트 추가하기

`index.html`의 `.projects` 안에 `.card` 하나를 추가하면 됩니다. 아직 배포 전인 프로젝트는
`.card.disabled`로 표시합니다.
