// 포에버 채팅 - 위쪽 여관 장면 (도트 캐릭터가 돌아다니고 말풍선이 뜸)
// 그림은 모두 코드로 찍은 우리 도트예요 (게임 그림을 가져오지 않음). 종족은 키·귀·뿔·피부색, 직업은 옷 색, 진영은 망토 색.
// 포에버봇은 로봇 머리를 한 작은 요정으로 바 위를 떠다녀요.

import { buildSprite, buildFairy, buildDrunk, shade, GW, FEET, CX } from "./sprites.js?v=5";

// 도트 한글 글꼴 Galmuri11 (이민서, SIL Open Font License) - 여관 글자에만 씀
const PF = "Galmuri11";
let fontReady = false;
try {
  const ff = new FontFace(PF, "url(https://cdn.jsdelivr.net/npm/galmuri@2.40.3/dist/Galmuri11.woff2) format('woff2')", { display: "swap" });
  document.fonts.add(ff); ff.load().then(() => { fontReady = true; }, () => {});
} catch {}
const font = (px) => `${px}px ${fontReady ? PF + ", " : ""}system-ui, sans-serif`;

const PX = 3;              // 화면 1px 도트 = CSS 3px
const FPS = 20;
const FACTION_CAPE = { alliance: "#2f5fb3", horde: "#9b2323" };
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rnd = (a, b) => a + Math.random() * (b - a);

export function createScene(canvas, opts = {}) {
  const classColor = opts.classColor || {};
  const emoteEmoji = opts.emoteEmoji || {};
  const ctx = canvas.getContext("2d");
  const low = document.createElement("canvas");
  const g = low.getContext("2d");
  let W = 120, H = 70, wallH = 30, barW = 26, dpr = 1, k = PX;
  const people = new Map();     // id → 캐릭터
  const bot = { x: 12, y: 20, bubble: null };
  let meId = null, running = false, raf = 0, last = 0, firstFill = true;
  // 방 두 개: 0 = 홀(지금 있는 사람), 1 = 침실(자리 비운·예전 사람이 자는 곳). 옆으로 넘겨서 봄
  let view = 0, cam = 0, hallNew = false, bgs = [null, null], infoSig = "";
  // 홀 오른쪽 벽 책장: 누르면 직업 도감(직업·특성 정리)으로
  let shelf = { x: 96, y: 8, w: 16, h: 20 };

  /* ---------- 크기 ---------- */
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    W = Math.max(60, Math.floor(r.width / PX)); H = Math.max(40, Math.floor(r.height / PX));
    low.width = W; low.height = H; k = PX * dpr;
    wallH = Math.round(H * 0.4); barW = 20;
    { const h = Math.min(wallH + 1, 22); shelf = { x: W - 24, w: 16, h, y: wallH + 3 - h }; }
    bgs = [makeBg(0), makeBg(1)];
    for (const a of people.values()) if (!a.asleep) clampPos(a);
    seatSleepers();
    draw(performance.now());
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  const area = () => ({ x0: 8, x1: W - 8, y0: wallH + 10, y1: H - 3 });
  function clampPos(a) {
    const r = area();
    a.x = Math.min(r.x1, Math.max(r.x0, a.x)); a.y = Math.min(r.y1, Math.max(r.y0, a.y));
    a.tx = Math.min(r.x1, Math.max(r.x0, a.tx ?? a.x)); a.ty = Math.min(r.y1, Math.max(r.y0, a.ty ?? a.y));
  }
  /* ---------- 침실: 침대 없이 바닥 아무 데나 아무 방향으로 널브러져 잠 (몇 명은 담요) ---------- */
  function seatSleepers() {
    const r = area();
    for (const a of people.values()) {
      if (!a.asleep || a.gone) continue;
      const h = hash(a.id), sp = sleepSprite(a), head = FEET - 11 - sp.top, m = Math.max(head, 13);
      a.bed = null; a.lie = h & 1 ? 1 : -1; a.blanket = (h >>> 7) % 3 !== 0;
      a.x = r.x0 + m + ((h >>> 4) % 1000) / 1000 * Math.max(1, r.x1 - r.x0 - 2 * m);
      a.y = r.y0 + 2 + ((h >>> 14) % 1000) / 1000 * Math.max(1, r.y1 - r.y0 - 2);
      a.tx = a.x; a.ty = a.y; a.walking = false;
    }
  }

  /* ---------- 사람 목록 ---------- */
  function upsert(p, { walkIn = false } = {}) {
    let a = people.get(p.id);
    if (!a) {
      const r = area(), h = hash(p.id);
      a = { id: p.id, seed: (h % 1000) / 160, nextMove: performance.now() + rnd(500, 4000), dir: h & 1 ? 1 : -1, alpha: 0, gone: false };
      if (walkIn) { a.x = W + 4; a.y = rnd(r.y0, r.y1); a.tx = rnd(r.x0 + 10, r.x1 - 6); a.ty = a.y; a.dir = -1; }
      else { a.x = rnd(r.x0, r.x1); a.y = rnd(r.y0, r.y1); a.tx = a.x; a.ty = a.y; if (firstFill || p.asleep) a.alpha = 1; }
      people.set(p.id, a);
    }
    Object.assign(a, { name: p.name, race: p.race, cls: p.cls, faction: p.faction, verified: p.verified !== false,
      level: p.level, realm: p.realm, gone: false, lantern: !!p.lantern });
    const wasAsleep = a.asleep; a.asleep = !!p.asleep;
    if (!a.asleep && wasAsleep) wakeUp(a);
    return a;
  }
  // 침실에서 일어나면 홀 왼쪽 문으로 걸어 들어옴
  function wakeUp(a) {
    const r = area();
    a.asleep = false; a.bed = null; a.x = -4; a.y = rnd(r.y0, r.y1); a.tx = rnd(r.x0 + 8, r.x1 - 10); a.ty = a.y; a.dir = 1;
    a.nextMove = performance.now() + rnd(2500, 5000);
  }
  function setPeople(list) {
    const keep = new Set();
    list.forEach((p, i) => {
      if (!p || !p.id) return; keep.add(p.id);
      const a = upsert(p, { walkIn: !firstFill && !p.asleep && !people.has(p.id) }); a.order = i;
    });
    for (const a of people.values()) if (!keep.has(a.id) && !a.bubble) a.gone = true;
    firstFill = false;
    seatSleepers(); info();
  }
  function info() {
    let hall = 0, bed = 0;
    for (const a of people.values()) if (!a.gone) a.asleep ? bed++ : hall++;
    const s = [view, hall, bed, hallNew].join("|");
    if (s !== infoSig) { infoSig = s; opts.onInfo?.({ room: view, hall, bed, hallNew }); }
  }
  function setRoom(i) {
    view = Math.max(0, Math.min(1, i));
    if (view === 0) hallNew = false;
    if (!running) cam = view, draw(performance.now());
    info();
  }

  /* ---------- 말풍선·감정 ---------- */
  function say(p, text, o = {}) {
    const now = performance.now();
    const t = String(text || "").replace(/\s+/g, " ").trim();
    const dur = Math.min(9000, 3500 + t.length * 70);
    if (o.bot) { bot.bubble = { text: t, until: now + dur, bot: true }; if (view === 1) { hallNew = true; info(); } return; }
    if (!p || !p.id) return;
    const a = people.get(p.id) || upsert(p, { walkIn: !p.asleep });
    if (a.asleep) { wakeUp(a); a.alpha = 1; seatSleepers(); }
    a.gone = false;
    if (view === 1 && a.id !== meId) hallNew = true;
    info();
    if (o.emote) {
      a.emote = { key: o.emote, until: now + 3200 };
      if (!t) return;
    }
    if (t) a.bubble = { text: t, until: now + dur, foreign: !!o.foreign };
    a.tx = a.x; a.ty = a.y; a.nextMove = now + dur;  // 말할 때는 멈춰 섬
  }

  /* ---------- 움직임 ---------- */
  function step(dt, now) {
    const r = area();
    for (const a of [...people.values()]) {
      a.alpha = a.gone ? Math.max(0, a.alpha - dt * 1.5) : Math.min(1, a.alpha + dt * 2);
      if (a.gone && a.alpha <= 0) { people.delete(a.id); if (a.asleep) seatSleepers(); info(); continue; }
      if (a.bubble && a.bubble.until < now) a.bubble = null;
      if (a.emote && a.emote.until < now) a.emote = null;
      if (a.asleep) { a.walking = false; continue; }
      if (!a.asleep && !a.gone && now > a.nextMove && !a.bubble) {
        a.tx = rnd(r.x0, r.x1); a.ty = rnd(r.y0, r.y1);
        a.nextMove = now + rnd(3500, 9000);
      }
      const dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
      const sp = (a.verified ? 9 : 6) * dt;
      a.walking = d > 0.6;
      if (a.walking) {
        a.x += dx / d * Math.min(sp, d); a.y += dy / d * Math.min(sp, d);
        if (Math.abs(dx) > 0.3) a.dir = dx > 0 ? 1 : -1;
      }
    }
    if (bot.bubble && bot.bubble.until < now) bot.bubble = null;
    cam += (view - cam) * Math.min(1, dt * 9); if (Math.abs(view - cam) < 0.004) cam = view;
    bot.x = barW / 2 + Math.sin(now / 1700) * 3; bot.y = wallH - 1 + Math.sin(now / 420) * 1.5;
  }

  /* ---------- 배경: 움직이지 않는 부드러운 그림 한 장 (크기 바뀔 때만 다시) ---------- */
  function makeBg(kind) {
    const b = document.createElement("canvas"); b.width = canvas.width; b.height = canvas.height;
    const c = b.getContext("2d"), wy = wallH * k, cw = b.width, ch = b.height;
    if (kind === 1) {   // 침실: 밤, 창문 달빛
      let gr = c.createLinearGradient(0, 0, 0, wy);
      gr.addColorStop(0, "#121527"); gr.addColorStop(1, "#22253d");
      c.fillStyle = gr; c.fillRect(0, 0, cw, wy);
      c.fillStyle = "rgba(0,0,0,.18)";
      for (let x = 22 * dpr; x < cw; x += 40 * dpr) c.fillRect(x, 0, 1.5 * dpr, wy);
      gr = c.createLinearGradient(0, wy, 0, ch);
      gr.addColorStop(0, "#2a2119"); gr.addColorStop(1, "#130d09");
      c.fillStyle = gr; c.fillRect(0, wy, cw, ch - wy);
      c.fillStyle = "rgba(0,0,0,.4)"; c.fillRect(0, wy, cw, 2 * dpr);
      // 창문 (도트 칸에 맞춤)
      const u = k, wx = Math.round(W * 0.74 - 8) * u, wyy = Math.max(2, Math.round(wallH * 0.18)) * u, ww = 16 * u, wh = Math.min(12, wallH - 6) * u;
      c.fillStyle = "#4a3420"; c.fillRect(wx - u, wyy - u, ww + 2 * u, wh + 2 * u);
      gr = c.createLinearGradient(0, wyy, 0, wyy + wh); gr.addColorStop(0, "#2f4277"); gr.addColorStop(1, "#1a2547");
      c.fillStyle = gr; c.fillRect(wx, wyy, ww, wh);
      c.fillStyle = "#f3eac0"; c.fillRect(wx + 10 * u, wyy + 2 * u, 3 * u, 3 * u); c.fillStyle = "#2f4277"; c.fillRect(wx + 11 * u, wyy + 2 * u, 2 * u, 2 * u);
      c.fillStyle = "#cfd8ff"; c.fillRect(wx + 3 * u, wyy + 3 * u, u, u); c.fillRect(wx + 6 * u, wyy + 6 * u, u, u);
      c.fillStyle = "#4a3420"; c.fillRect(wx + 8 * u - u / 2, wyy, u, wh); c.fillRect(wx, wyy + Math.round(wh / 2 / u) * u, ww, u);
      { let sd = 7; const R = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
        for (let i = 0; i < 6; i++) {
          const bx = Math.round(4 + R() * (W - 14)), by = Math.round(wallH + 5 + R() * (H - wallH - 8)), P = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect((bx + x) * u, (by + y) * u, w * u, h * u); };
          if (R() < 0.3) { P(0, 0, 4, 3, "#1a110a"); P(1, 0, 2, 2, "#e9a72a"); P(0, 0, 1, 1, "#fff8e6"); }   // 엎어진 맥주잔
          else { P(-1, 2, 8, 1, "rgba(0,0,0,.35)"); P(0, 0, 5, 2, "#2f6a33"); P(1, 0, 3, 1, "#5fa864"); P(5, 0, 1, 1, "#2f6a33"); P(6, 0, 1, 1, "#c9a46a"); }
        } }
      gr = c.createRadialGradient(wx + ww / 2, wy, 0, wx + ww / 2, wy, Math.max(cw, ch) * 0.55);
      gr.addColorStop(0, "rgba(150,170,255,.14)"); gr.addColorStop(1, "rgba(150,170,255,0)");
      c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
      gr = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.45)");
      c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
      return b;
    }
    let gr = c.createLinearGradient(0, 0, 0, wy);
    gr.addColorStop(0, "#22170d"); gr.addColorStop(1, "#3b2817");
    c.fillStyle = gr; c.fillRect(0, 0, cw, wy);
    c.fillStyle = "rgba(0,0,0,.13)";
    for (let x = 18 * dpr; x < cw; x += 34 * dpr) c.fillRect(x, 0, 1.5 * dpr, wy);
    gr = c.createLinearGradient(0, wy, 0, ch);
    gr.addColorStop(0, "#33231a"); gr.addColorStop(1, "#1b120b");
    c.fillStyle = gr; c.fillRect(0, wy, cw, ch - wy);
    c.fillStyle = "rgba(0,0,0,.35)"; c.fillRect(0, wy, cw, 2 * dpr);
    c.fillStyle = "rgba(255,255,255,.04)"; c.fillRect(0, wy + 2 * dpr, cw, 1 * dpr);
    // 책장 (도트 칸에 맞춤)
    {
      const u = k, { w: sw, h: sh } = shelf;
      const P = (x, y, w, h, col) => { c.fillStyle = col; c.fillRect((shelf.x + x) * u, (shelf.y + y) * u, w * u, h * u); };
      P(-1, sh, sw + 3, 1, "rgba(0,0,0,.4)");
      P(sw, 1, 1, sh, "rgba(0,0,0,.3)");
      P(0, 0, sw, sh, "#4a2f17");
      P(0, 0, sw, 1, "#7a5230");
      P(1, 1, sw - 2, sh - 2, "#1c1009");
      const rows = sh >= 18 ? 3 : 2, rowH = Math.floor((sh - 2) / rows) - 1;
      let seed = 11;
      const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
      const COL = ["#8b2b2b", "#2f5a8a", "#3f7a3a", "#a8862e", "#6a3d8a", "#b0582a", "#5b6f7a", "#7a2f55"];
      for (let r = 0; r < rows; r++) {
        const top = 1 + r * (rowH + 1), bot = top + rowH;
        let x = 1;
        while (x < sw - 1) {
          if (rnd() < 0.1 && x > 2) { x += 1; continue; }        // 빈 칸
          const bw = Math.min(sw - 1 - x, rnd() < 0.35 ? 2 : 1);
          const bh = rowH - Math.floor(rnd() * 3);
          const col = COL[Math.floor(rnd() * COL.length)];
          P(x, bot - bh, bw, bh, col);
          P(x, bot - bh, bw, 1, "rgba(255,255,255,.18)");
          if (bh >= 4) P(x, bot - bh + 2, bw, 1, "rgba(255,215,130,.45)");   // 금박 띠
          x += bw;
        }
        P(1, bot, sw - 2, 1, "#5a3a1c");
      }
      P(sw - 5, -2, 3, 2, "#e8dcc0"); P(sw - 4, -3, 1, 1, "#ffd36a");   // 위에 올린 두루마리
    }
    // 따뜻한 불빛
    gr = c.createRadialGradient(cw * 0.78, wy * 0.9, 0, cw * 0.78, wy * 0.9, Math.max(cw, ch) * 0.6);
    gr.addColorStop(0, "rgba(255,170,80,.16)"); gr.addColorStop(1, "rgba(255,170,80,0)");
    c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
    gr = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.35)");
    c.fillStyle = gr; c.fillRect(0, 0, cw, ch);
    return b;
  }

  // 그림은 한 번 만들어 두고 재사용 (종족·직업·진영·자세·취함)
  const cache = new Map();
  function spriteOf(a, pose) {
    const key = [a.race, a.cls, a.faction, pose, a.verified ? 0 : 1].join("|");
    let sp = cache.get(key);
    if (!sp) { sp = buildSprite(a.race, a.cls, a.faction, pose, !a.verified, classColor[a.cls]); cache.set(key, sp); }
    return sp;
  }
  function drawSprite(sp, x, y, dir) {
    if (dir >= 0) g.drawImage(sp.can, x - CX, y - FEET);
    else { g.save(); g.scale(-1, 1); g.drawImage(sp.can, -(x + CX + 1) + 0, y - FEET); g.restore(); }
  }
  const drunkOf = (fr, sleep) => {
    const key = "drunk|" + (sleep ? "s" : fr);
    let sp = cache.get(key); if (!sp) { sp = buildDrunk(sleep ? 0 : fr, sleep); cache.set(key, sp); }
    return sp;
  };
  const sleepSprite = (a) => (a.verified ? spriteOf(a, "sleep") : drunkOf(0, true));
  // 누운 사람의 머리 x (이름표·Z 위치)
  const headX = (a) => { const sp = sleepSprite(a), h = FEET - 11 - sp.top; return a.x + (a.lie < 0 ? h - 4 : -h + 4); };
  function person(a, now) {
    // 자는 사람: 옆으로 누움 (침대 위거나 바닥에 아무렇게나)
    if (a.asleep) {
      const sp = sleepSprite(a), x = Math.round(a.x), y = Math.round(a.y);
      g.globalAlpha = a.alpha * 0.3; g.fillStyle = "#000"; g.fillRect(x - 15, y + 1, 28, 1);
      g.globalAlpha = a.alpha;
      g.save(); g.translate(x, y); if (a.lie < 0) g.scale(-1, 1); g.rotate(-Math.PI / 2);
      g.drawImage(sp.can, -(CX - 7), 11 - FEET);
      g.restore();
      if (a.blanket) {   // 목 아래부터 발끝까지 덮고 들썩들썩
        const hd = FEET - 11 - sp.top, br = Math.floor(now / 1100 + a.seed) % 2;
        const x0 = a.lie > 0 ? x - hd + 7 : x - 12, x1 = a.lie > 0 ? x + 12 : x + hd - 7, len = x1 - x0;
        const q = QUILT[hash(a.id) % QUILT.length], qs = shade(q, 0.72), ql = shade(q, 1.3);
        // 몸 따라 봉긋하게: 어깨에서 엉덩이 쪽이 높고 발끝으로 낮아짐
        for (let i = 0; i < len; i++) {
          const u = a.lie > 0 ? i / len : 1 - i / len;
          const hgt = Math.round(4 + 4 * Math.sin(Math.PI * Math.min(1, u * 1.25 + 0.08))) + (u < 0.7 ? br : 0);
          const cx = x0 + i, ty = y - hgt;
          g.fillStyle = "#1a110a"; g.fillRect(cx, ty - 1, 1, hgt + 2);
          g.fillStyle = q; g.fillRect(cx, ty, 1, hgt + 1);
          g.fillStyle = ql; g.fillRect(cx, ty, 1, 1);
          if (i % 6 === 3) { g.fillStyle = qs; g.fillRect(cx, ty + 2, 1, 1); g.fillRect(cx, ty + 4, 1, 1); }
        }
        g.fillStyle = "#1a110a"; g.fillRect(x0 - 1, y - 4, 1, 5); g.fillRect(x1, y - 4, 1, 5);
        g.fillStyle = qs; g.fillRect(x0, y, len, 1);
      }
      g.globalAlpha = 1;
      a.h = 14;
      return y - 14;
    }
    // 취객(손님)은 종족과 상관없이 술 취한 유령
    if (!a.verified) {
      const fr = Math.floor(now / 260) % 2, sp = drunkOf(fr, false);
      const x = Math.round(a.x + Math.sin(now / 380 + a.seed) * 1.6);
      const y = Math.round(a.y - 2 + Math.sin(now / 520 + a.seed) * 1.5);
      g.globalAlpha = a.alpha * 0.25; g.fillStyle = "#000"; g.fillRect(Math.round(a.x) - 5, Math.round(a.y) + 1, 11, 1);
      g.globalAlpha = a.alpha; drawSprite(sp, x, y, a.dir || 1); g.globalAlpha = 1;
      a.h = FEET - sp.top + 2;
      return y - (FEET - sp.top);
    }
    let pose = "stand";
    if (a.emote && /(인사|안녕|손|경례|환영|작별|잘가)/.test(a.emote.key)) pose = Math.floor(now / 220) % 2 ? "wave" : "stand";
    else if (a.walking) pose = Math.floor(now / 170) % 2 ? "walk1" : "walk2";
    const sp = spriteOf(a, pose);
    let x = Math.round(a.x), y = Math.round(a.y);
    if (a.emote && /춤/.test(a.emote.key)) y -= Math.round(Math.abs(Math.sin(now / 110)) * 3);
    if (!a.verified && !a.asleep) x += Math.round(Math.sin(now / 380 + a.seed) * 1.4);
    if (pose === "stand" && Math.floor(now / 650 + a.seed) % 2 === 0) y += 0; else if (pose === "stand") y += 1;
    g.globalAlpha = a.alpha * 0.32; g.fillStyle = "#000"; g.fillRect(Math.round(a.x) - 5, Math.round(a.y) + 1, 11, 1); g.fillRect(Math.round(a.x) - 3, Math.round(a.y) + 2, 7, 1);
    g.globalAlpha = a.alpha;
    drawSprite(sp, x, y, a.dir || 1);
    if (a.lantern) lantern(x + (a.dir || 1) * 6, y - 9, now);
    g.globalAlpha = 1;
    a.h = FEET - sp.top;
    return y - (FEET - sp.top);
  }
  // 등불 (길드 찾는 중): 손에 들고 깜빡이는 불빛
  function lantern(hx, hy, now) {
    const fl = Math.floor(now / 170 + hx * 7) % 3;
    lamps.push({ x: hx, y: hy + 3, fl });
    g.fillStyle = "#1a110a"; g.fillRect(hx, hy - 2, 1, 2); g.fillRect(hx - 2, hy, 5, 6);
    g.fillStyle = "#8a5a30"; g.fillRect(hx - 1, hy, 3, 1); g.fillRect(hx - 1, hy + 5, 3, 1);
    g.fillStyle = fl ? "#ffd36a" : "#fff3b0"; g.fillRect(hx - 1, hy + 1, 3, 4);
    g.fillStyle = "#ff8a2a"; g.fillRect(hx, hy + (fl === 2 ? 2 : 3), 1, 2);
  }
  // 담요 색
  const QUILT = ["#7a3b3b", "#3b5a7a", "#4f6b3a", "#6b4a7a", "#7a6236", "#3a6b66"];
  const lamps = [];   // 이번 그림의 등불 자리 (불빛은 나중에 둥글게)
  const fairyFrames = [buildFairy(false, false), buildFairy(false, true), buildFairy(true, false)];
  function fairy(now) {
    const x = Math.round(bot.x), y = Math.round(bot.y);
    const flap = Math.floor(now / 130) % 2;
    // 나비 날개: 머리 옆으로 위 날개(크게)·허리·아래 날개(작게). 폈다 접었다
    g.globalAlpha = 0.92;
    const W8 = flap ? [3, 4, 4, 3, 1, 2, 3, 2] : [2, 3, 3, 2, 1, 1, 2, 1];
    for (const sd of [-1, 1]) {
      const ax = sd < 0 ? x - 5 : x + 5, y0 = y - 14;
      W8.forEach((w, i) => {
        for (let d = 0; d < w; d++) {
          const edge = d === w - 1 || i === 0 || i === 7 || i === 4;
          const spot = flap && (i === 1 || i === 2) && d === 1;
          g.fillStyle = spot ? "#fff3b0" : edge ? "#b46ad0" : "#f6b8e6";
          g.fillRect(ax + sd * d, y0 + i, 1, 1);
        }
      });
    }
    g.globalAlpha = 1;
    const blink = Math.floor(now / 2600) % 7 === 0 && (now % 2600) < 180;
    const fr = fairyFrames[blink ? 2 : Math.floor(now / 300) % 2];
    g.drawImage(fr.can, x - 7, y - 17);
    if (Math.random() < 0.5) { g.fillStyle = "#fff3b0"; g.fillRect(x + Math.round(rnd(-9, 9)), y + Math.round(rnd(-16, 2)), 1, 1); }
    return y - 17 + fr.top;
  }

  /* ---------- 글자·말풍선 (도트 느낌: 각진 테두리, 도트 글꼴) ---------- */
  function wrap(c, text, maxW, lines) {
    const out = []; let cur = "";
    for (const ch of [...text]) {
      if (c.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch; if (out.length === lines) break; }
      else cur += ch;
    }
    if (out.length < lines && cur) out.push(cur);
    if (out.length === lines && out.join("").length < [...text].length) out[lines - 1] = out[lines - 1].slice(0, -1) + "…";
    return out;
  }
  // 계단 모서리 상자: 바깥 테두리 → 안쪽 채움 (u = 도트 한 칸)
  function pixBox(c, x, y, w, h, u, line, fill) {
    c.fillStyle = line; c.fillRect(x + u, y, w - 2 * u, h); c.fillRect(x, y + u, w, h - 2 * u);
    c.fillStyle = fill; c.fillRect(x + 2 * u, y + u, w - 4 * u, h - 2 * u); c.fillRect(x + u, y + 2 * u, w - 2 * u, h - 4 * u);
  }
  function bubble(cx, bottomY, b, sideY) {
    const c = ctx, u = 2 * dpr, fs = 11 * dpr, lh = 15 * dpr, pad = 5 * u, maxW = Math.min(170 * dpr, canvas.width * 0.66);
    const snap = (v) => Math.round(v / u) * u;
    c.font = font(fs);
    const lines = wrap(c, b.text, maxW - pad * 2, 2);
    const w = snap(Math.max(...lines.map((l) => c.measureText(l).width)) + pad * 2), h = snap(lines.length * lh + 3 * u * 2);
    cx = snap(cx);
    // sideY가 있으면 캐릭터 오른쪽 옆에 (위쪽 탭에 안 가리게), 꼬리는 왼쪽
    const side = sideY != null;
    let x = side ? cx : snap(cx - w / 2); x = Math.max(u * 2, Math.min(canvas.width - w - u * 2, x));
    const y = side ? snap(Math.max(u, sideY - h / 2)) : snap(Math.max(u, bottomY - h - 3 * u));
    const line = b.bot ? "#e6c36a" : "#1a110a", fill = b.bot ? "#2a2112" : "#f7ecd2";
    // 그림자 → 상자 → 꼬리
    pixBox(c, x + u, y + u, w, h, u, "rgba(0,0,0,.35)", "rgba(0,0,0,.35)");
    pixBox(c, x, y, w, h, u, line, fill);
    if (!b.bot) { c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(x + 2 * u, y + u, w - 4 * u, u); }
    if (side) {
      const ty = snap(Math.min(y + h - 4 * u, Math.max(y + 2 * u, sideY - u)));
      c.fillStyle = fill; c.fillRect(x, ty, u, 2 * u); c.fillRect(x - u, ty, u, 2 * u);
      c.fillStyle = line; c.fillRect(x - u, ty - u, u, u); c.fillRect(x - u, ty + 2 * u, u, u); c.fillRect(x - 2 * u, ty, u, 2 * u);
    } else {
      const tx = Math.max(x + 3 * u, Math.min(x + w - 4 * u, cx - u));
      c.fillStyle = fill; c.fillRect(tx, y + h - u, 2 * u, u); c.fillRect(tx, y + h, 2 * u, u);
      c.fillStyle = line; c.fillRect(tx - u, y + h, u, u); c.fillRect(tx + 2 * u, y + h, u, u); c.fillRect(tx, y + h + u, 2 * u, u);
    }
    c.fillStyle = b.bot ? "#f1dfae" : b.foreign ? "#8a7e6a" : "#2a1d10"; c.textBaseline = "top"; c.textAlign = "left";
    lines.forEach((l, i) => c.fillText(l, x + pad, y + 3 * u + i * lh + dpr));
  }
  // 도트 글자 + 한 칸 검은 테두리
  function outlined(text, x, y, color, px) {
    const c = ctx, o = dpr;
    c.font = font(px * dpr); c.fillStyle = "#1a110a";
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [o, o]]) c.fillText(text, x + dx, y + dy);
    c.fillStyle = color; c.fillText(text, x, y);
  }
  function label(cx, y, text, color, dim, bold) {
    const c = ctx; c.textAlign = "center"; c.textBaseline = "bottom";
    outlined(text, Math.round(cx), Math.round(y), color, 11);
  }

  function draw(now) {
    if (!low.width) return;
    g.clearRect(0, 0, W, H); lamps.length = 0;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // 보이는 방만 (넘기는 중이면 두 방 다)
    const rooms = [];
    for (const rm of [0, 1]) {
      const off = Math.round((rm - cam) * W);
      if (Math.abs(off) >= W) continue;
      rooms.push({ rm, off, list: [...people.values()].filter((a) => (a.asleep ? 1 : 0) === rm).sort((a, b) => a.y - b.y), tops: new Map() });
    }
    for (const R of rooms) if (bgs[R.rm]) ctx.drawImage(bgs[R.rm], R.off * k, 0);
    for (const R of rooms) {
      g.save(); g.translate(R.off, 0);
      if (R.rm === 1) {
        for (const a of R.list) R.tops.set(a.id, person(a, now));   // 앞뒤(y) 순서
      } else {
        for (const a of R.list) R.tops.set(a.id, person(a, now));
        if (view === 0) R.fairyTop = fairy(now);   // 포에버봇은 홀에만 (침실로 넘기면 안 보임)
      }
      g.restore();
    }
    ctx.drawImage(low, 0, 0, W * k, H * k);
    for (const L of lamps) {
      const cx = L.x * k, cy = L.y * k, rr = (L.fl ? 9 : 10) * k;
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
      gr.addColorStop(0, "rgba(255,210,110,.38)"); gr.addColorStop(1, "rgba(255,210,110,0)");
      ctx.fillStyle = gr; ctx.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
    }
    // 이름표
    for (const R of rooms) {
      for (const a of R.list) {
        if (a.alpha <= 0.05) continue;
        const top = R.tops.get(a.id) - 1, ax = a.asleep ? headX(a) : a.x, x = ax + R.off;
        label(x * k, top * k, a.name || "", a.verified ? (classColor[a.cls] || "#ddd") : "#d9d3ff", false, a.id === meId);
        if (!a.verified && !a.asleep) {   // 가끔 딸꾹!
          const ph = (now / 1000 + a.seed * 3) % 7;
          if (ph < 1.2) {
            ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.globalAlpha = Math.max(0, 1 - ph / 1.2);
            outlined("딸꾹!", (x + 6) * k, top * k - (13 + ph * 8) * dpr, "#ffb3c1", 11);
            ctx.globalAlpha = 1;
          }
        }
        if (a.asleep && a.blanket) {   // 담요 덮은 사람만 Z z
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          const side = a.lie < 0 ? 1 : -1;
          const t = (now / 2200 + a.seed) % 1;
          ctx.globalAlpha = Math.max(0, Math.min(1, 1.3 - t * 1.3));
          outlined(t < 0.5 ? "z" : "Z", Math.round((x + side * (5 + t * 3)) * k), Math.round((top - 4 - t * 4) * k), "#c9d4ff", t < 0.5 ? 10 : 13);
          ctx.globalAlpha = 1;
        }
        if (a.emote && emoteEmoji[a.emote.key]) {
          ctx.font = `${16 * dpr}px system-ui`; ctx.textAlign = "center";
          ctx.fillText(emoteEmoji[a.emote.key], x * k, (top - 4) * k - 10 * dpr);
        }
      }
      if (R.rm === 0 && view === 0) label((bot.x + R.off) * k, (R.fairyTop - 1) * k, "포에버봇", "#e6c36a", false, false);
      if (R.rm === 0) label((shelf.x + shelf.w / 2 + R.off) * k, (shelf.y + shelf.h + 1) * k + 12 * dpr, "📖 직업 도감", "#f0d48a", false, false);
    }
    // 말풍선은 맨 위에
    for (const R of rooms) {
      for (const a of R.list) if (a.bubble && a.alpha > 0.3 && a.x + R.off > 0 && a.x + R.off < W) bubble((a.x + R.off) * k, (R.tops.get(a.id) - 1) * k - 13 * dpr, a.bubble);
      if (R.rm === 0 && view === 0 && R.off > -W / 3 && bot.bubble) bubble((bot.x + R.off + 11) * k, 0, bot.bubble, (bot.y - 8) * k);
    }
  }

  function loop(t) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (t - last < 1000 / FPS) return;
    const dt = Math.min(0.25, (t - (last || t)) / 1000); last = t;
    step(dt, t); draw(t);
  }
  function setRunning(on) {
    if (on && !running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    else if (!on && running) { running = false; cancelAnimationFrame(raf); }
  }

  /* ---------- 누르기 ---------- */
  // 옆으로 밀면 방 넘기기
  let sw = null, swiped = 0;
  canvas.addEventListener("pointerdown", (e) => { sw = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener("pointerup", (e) => {
    if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.4) { setRoom(view + (dx < 0 ? 1 : -1)); swiped = performance.now(); }
  });
  canvas.addEventListener("pointercancel", () => { sw = null; });
  canvas.addEventListener("click", (e) => {
    if (performance.now() - swiped < 400 || cam !== view) return;
    const r = canvas.getBoundingClientRect();
    const lx = (e.clientX - r.left) / PX, ly = (e.clientY - r.top) / PX;
    if (view === 0 && Math.abs(lx - bot.x) < 9 && ly > bot.y - 18 && ly < bot.y + 3) { opts.onTap?.({ bot: true }); return; }
    const list = [...people.values()].filter((a) => a.alpha > 0.3 && (a.asleep ? 1 : 0) === view).sort((a, b) => b.y - a.y);
    for (const a of list) {
      if (a.asleep) { if (Math.abs(lx - (a.x + (a.lie < 0 ? 3 : -3))) < 15 && ly <= a.y + 2 && ly >= a.y - 16) { opts.onTap?.(a); return; } continue; }
      if (Math.abs(lx - a.x) < 8 && ly <= a.y + 2 && ly >= a.y - (a.h || 22) - 2) { opts.onTap?.(a); return; }
    }
    if (view === 0 && lx >= shelf.x - 2 && lx <= shelf.x + shelf.w + 2 && ly >= shelf.y - 3 && ly <= shelf.y + shelf.h + 6) opts.onTap?.({ shelf: true });
  });

  return {
    setPeople, say, setRunning, setRoom,
    get room() { return view; },
    setMe(id) { meId = id; },
    // 자리 고정 (그림 확인용): 화면 비율 0~1로
    place(id, fx, fy, dir = 1) {
      const a = people.get(id); if (!a) return; const r = area();
      a.x = a.tx = r.x0 + (r.x1 - r.x0) * fx; a.y = a.ty = r.y0 + (r.y1 - r.y0) * fy;
      a.dir = dir; a.alpha = 1; a.nextMove = Infinity;
    },
    reset() { people.clear(); bot.bubble = null; firstFill = true; hallNew = false; infoSig = ""; },
    resize,
    destroy() { setRunning(false); ro.disconnect(); },
  };
}
