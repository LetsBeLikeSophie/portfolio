// 홈 화면 앱(주소창 없는 모드)에서는 뒤로/앞으로 버튼이 없어서, 화면 가장자리를 밀어서 이동하게 해요.
// 왼쪽 끝에서 오른쪽으로 밀기 = 이전 화면, 오른쪽 끝에서 왼쪽으로 밀기 = 앞에서 봤던 화면.
// 브라우저(사파리·크롬)에는 원래 이 동작이 있어서, 겹치지 않게 홈 화면 앱일 때만 켜요.
(() => {
  const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  if (!standalone || !("ontouchstart" in window)) return;
  const EDGE = 28, GO = 80;
  const canBack = () => (window.navigation && "canGoBack" in navigation) ? navigation.canGoBack : history.length > 1;
  const canFwd = () => (window.navigation && "canGoForward" in navigation) ? navigation.canGoForward : true;
  const tip = document.createElement("div");
  tip.style.cssText = "position:fixed;top:50%;z-index:2147483647;width:44px;height:44px;margin-top:-22px;border-radius:50%;" +
    "background:#e6c36a;color:#1a1208;font:800 22px/44px sans-serif;text-align:center;box-shadow:0 4px 16px #000a;" +
    "pointer-events:none;opacity:0;transition:opacity .15s";
  let side = null, x0 = 0, y0 = 0, dx = 0, off = false;
  const place = () => {
    const d = Math.min(Math.abs(dx), 140), p = Math.min(d / GO, 1);
    tip.style.opacity = String(p);
    tip.style.transform = `scale(${0.6 + 0.4 * p})`;
    if (side === "L") { tip.style.left = (d / 2 - 22) + "px"; tip.style.right = ""; }
    else { tip.style.right = (d / 2 - 22) + "px"; tip.style.left = ""; }
  };
  addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    side = t.clientX < EDGE ? "L" : t.clientX > innerWidth - EDGE ? "R" : null;
    if (side === "L" && !canBack()) side = null;
    if (side === "R" && !canFwd()) side = null;
    if (!side) return;
    x0 = t.clientX; y0 = t.clientY; dx = 0; off = false;
    tip.textContent = side === "L" ? "‹" : "›";
    if (!tip.isConnected) document.body.appendChild(tip);
  }, { passive: true });
  addEventListener("touchmove", (e) => {
    if (!side || off) return;
    const t = e.touches[0];
    dx = t.clientX - x0;
    if (Math.abs(t.clientY - y0) > 60 && Math.abs(t.clientY - y0) > Math.abs(dx)) { off = true; tip.style.opacity = "0"; return; }
    if ((side === "L" && dx < 0) || (side === "R" && dx > 0)) dx = 0;
    place();
  }, { passive: true });
  const end = () => {
    if (!side) return;
    const go = !off && Math.abs(dx) >= GO, s = side;
    side = null; tip.style.opacity = "0";
    if (go) { if (s === "L") history.back(); else history.forward(); }
  };
  addEventListener("touchend", end, { passive: true });
  addEventListener("touchcancel", () => { side = null; tip.style.opacity = "0"; }, { passive: true });
})();
