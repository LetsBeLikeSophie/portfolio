// 공유기 사진에서 QR을 찾는 일꾼 (화면이 멈추지 않게 따로 돌림). jsQR은 같은 폴더의 jsQR.js
// 라벨에는 QR이 여러 개 있거나 글자·바코드가 섞여 있어서 사진 전체로는 잘 못 찾음 →
// 사진 전체, 그다음 점점 작은 칸으로 나눠 훑어서 찾음. 와이파이 QR을 찾은 단계에서 멈춤
importScripts('jsQR.js');
// jsQR 1.4.0은 가끔 조각에 따라 오류를 내고 멈춤 → 그 조각만 건너뜀
function qr(d, w, h, inv) { try { return jsQR(d, w, h, { inversionAttempts: inv }); } catch (e) { return null; } }
function grab(px, W, x0, y0, w, h) {
  var out = new Uint8ClampedArray(w * h * 4);
  for (var y = 0; y < h; y++) out.set(px.subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + w) * 4), y * w * 4);
  return out;
}
self.onmessage = function (e) {
  var W = e.data.w, H = e.data.h, px = new Uint8ClampedArray(e.data.buf), found = [], seen = {}, t0 = Date.now();
  var add = function (r, x0, y0) {
    if (!r || !r.data || seen[r.data]) return false;
    seen[r.data] = 1;
    var L = r.location, xs = [L.topLeftCorner.x, L.topRightCorner.x, L.bottomLeftCorner.x, L.bottomRightCorner.x],
        ys = [L.topLeftCorner.y, L.topRightCorner.y, L.bottomLeftCorner.y, L.bottomRightCorner.y];
    var x1 = Math.min.apply(0, xs) + x0, x2 = Math.max.apply(0, xs) + x0, y1 = Math.min.apply(0, ys) + y0, y2 = Math.max.apply(0, ys) + y0;
    found.push({ text: r.data, box: { x: x1 / W, y: y1 / H, w: (x2 - x1) / W, h: (y2 - y1) / H } });
    // 찾은 QR은 회색으로 덮어서, 옆에 붙은 다른 QR(5G·2.4G 따로)을 헷갈리지 않고 찾게 함
    var pad = Math.max(x2 - x1, y2 - y1) * 0.15;
    x1 = Math.max(0, Math.floor(x1 - pad)); y1 = Math.max(0, Math.floor(y1 - pad));
    x2 = Math.min(W, Math.ceil(x2 + pad)); y2 = Math.min(H, Math.ceil(y2 + pad));
    for (var yy = y1; yy < y2; yy++) px.fill(128, (yy * W + x1) * 4, (yy * W + x2) * 4);
    return true;
  };
  var wifi = function () { return found.some(function (f) { return /^WIFI:/i.test(f.text); }); };
  if (add(qr(px, W, H, 'attemptBoth'), 0, 0)) add(qr(px, W, H, 'attemptBoth'), 0, 0);
  var m = Math.min(W, H);
  var level = function (frac) {
    var s = Math.round(m * frac), step = Math.max(1, Math.round(s / 3)), hit = false;
    for (var y = 0; y < H - s / 2; y += step) for (var x = 0; x < W - s / 2; x += step) {
      var w = Math.min(s, W - x), h = Math.min(s, H - y);
      if (add(qr(grab(px, W, x, y, w, h), w, h, 'attemptBoth'), x, y)) hit = true; // 검은 라벨은 QR 색이 뒤집혀 있음
    }
    return hit;
  };
  [0.5, 0.34, 0.25].some(function (frac) {
    if (wifi() || Date.now() - t0 > 12000) return true;
    // 이 크기에서 하나라도 찾았으면, 덮은 상태로 한 번 더 훑어 남은 QR까지
    if (level(frac)) level(frac);
    return false;
  });
  self.postMessage(found);
};
