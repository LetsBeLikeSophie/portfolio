// 홈 화면에 설치할 수 있게 하고, 휴대폰 알림(웹 푸시)을 띄우는 서비스 워커.
// 채팅은 항상 실시간이어야 해서 아무것도 저장(캐시)하지 않고 그대로 인터넷에서 받아요.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "와우 포에버 채팅", {
    body: d.body || "",
    icon: "/forever/icon-192.png",
    badge: "/forever/icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    data: { url: d.url || "/forever/" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/forever/", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (c.url.startsWith(self.location.origin + "/forever/")) {
        try { await c.focus(); } catch (_) { /* */ }
        c.postMessage({ type: "open", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
