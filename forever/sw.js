// 홈 화면에 설치할 수 있게 하는 최소한의 서비스 워커.
// 채팅은 항상 실시간이어야 해서 아무것도 저장(캐시)하지 않고 그대로 인터넷에서 받아요.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
