// 포에버 채팅 - 위쪽 여관 장면 (도트 캐릭터가 돌아다니고 말풍선이 뜸)
// 그림은 모두 코드로 찍은 우리 도트예요 (게임 그림을 가져오지 않음). 종족은 키·귀·뿔·피부색, 직업은 옷 색, 진영은 망토 색.
// 포에버봇은 로봇 머리를 한 작은 요정으로 바 위를 떠다녀요.

import { buildSprite, buildFairy, GW, FEET, CX } from "./sprites.js?v=2";

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
  let meId = null, running = false, raf = 0, last = 0, firstFill = true, fire = [];

  /* ---------- 크기 ---------- */
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    W = Math.max(60, Math.floor(r.width / PX)); H = Math.max(40, Math.floor(r.height / PX));
    low.width = W; low.height = H; k = PX * dpr;
    wallH = Math.round(H * 0.4); barW = Math.max(20, Math.min(34, Math.round(W * 0.2)));
    for (const a of people.values()) clampPos(a);
    draw(performance.now());
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  const area = () => ({ x0: barW + 5, x1: W - 6, y0: wallH + 9, y1: H - 3 });
  function clampPos(a) {
    const r = area();
    a.x = Math.min(r.x1, Math.max(r.x0, a.x)); a.y = Math.min(r.y1, Math.max(r.y0, a.y));
    a.tx = Math.min(r.x1, Math.max(r.x0, a.tx ?? a.x)); a.ty = Math.min(r.y1, Math.max(r.y0, a.ty ?? a.y));
  }
  function restSpot(a) {
    const r = area(), h = hash(a.id);
    return { x: r.x0 + (h % Math.max(1, r.x1 - r.x0)), y: r.y0 + ((h >> 8) % 3) };
  }

  /* ---------- 사람 목록 ---------- */
  function upsert(p, { walkIn = false } = {}) {
    let a = people.get(p.id);
    if (!a) {
      const r = area(), h = hash(p.id);
      a = { id: p.id, seed: (h % 1000) / 160, nextMove: performance.now() + rnd(500, 4000), dir: h & 1 ? 1 : -1, alpha: 0, gone: false };
      if (walkIn) { a.x = W + 4; a.y = rnd(r.y0, r.y1); a.tx = rnd(r.x0 + 10, r.x1 - 6); a.ty = a.y; a.dir = -1; }
      else { a.x = rnd(r.x0, r.x1); a.y = rnd(r.y0, r.y1); a.tx = a.x; a.ty = a.y; }
      people.set(p.id, a);
    }
    Object.assign(a, { name: p.name, race: p.race, cls: p.cls, faction: p.faction, verified: p.verified !== false,
      level: p.level, realm: p.realm, gone: false });
    const wasAsleep = a.asleep; a.asleep = !!p.asleep;
    if (a.asleep && !wasAsleep) { const s = restSpot(a); a.tx = s.x; a.ty = s.y; }
    if (!a.asleep && wasAsleep) a.nextMove = performance.now() + rnd(300, 1500);
    return a;
  }
  function setPeople(list) {
    const keep = new Set();
    for (const p of list) { if (!p || !p.id) continue; keep.add(p.id); upsert(p, { walkIn: !firstFill && !p.asleep && !people.has(p.id) }); }
    for (const a of people.values()) if (!keep.has(a.id) && !a.bubble) a.gone = true;
    firstFill = false;
  }

  /* ---------- 말풍선·감정 ---------- */
  function say(p, text, o = {}) {
    const now = performance.now();
    const t = String(text || "").replace(/\s+/g, " ").trim();
    const dur = Math.min(9000, 3500 + t.length * 70);
    if (o.bot) { bot.bubble = { text: t, until: now + dur, bot: true }; return; }
    if (!p || !p.id) return;
    const a = people.get(p.id) || upsert(p, { walkIn: !p.asleep });
    if (a.asleep) { a.asleep = false; a.nextMove = now + 2500; }
    a.gone = false;
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
      a.alpha = a.gone ? Math.max(0, a.alpha - dt * 1.5) : Math.min(a.asleep ? 0.55 : 1, a.alpha + dt * 2);
      if (a.gone && a.alpha <= 0) { people.delete(a.id); continue; }
      if (a.bubble && a.bubble.until < now) a.bubble = null;
      if (a.emote && a.emote.until < now) a.emote = null;
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
    bot.x = barW / 2 + Math.sin(now / 1700) * 3; bot.y = wallH - 1 + Math.sin(now / 420) * 1.5;
  }

  /* ---------- 그리기 (저해상도 도트) ---------- */
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
  function room(now) {
    // 벽 (나무 판자)
    px(0, 0, W, wallH, "#3a2716");
    for (let x = 3; x < W; x += 8) px(x, 0, 1, wallH, "#2f1f11");
    px(0, 0, W, 2, "#24170c"); px(0, wallH - 1, W, 1, "#1d130a");
    // 바닥
    px(0, wallH, W, H - wallH, "#2b1d11");
    for (let y = wallH + 4; y < H; y += 5) px(0, y, W, 1, "#24180e");
    // 창문 (밤하늘)
    const wx = Math.round(W * 0.42), wy = 5;
    px(wx - 1, wy - 1, 16, 12, "#5a3d22"); px(wx, wy, 14, 10, "#1b2747");
    px(wx + 7, wy, 1, 10, "#5a3d22"); px(wx, wy + 5, 14, 1, "#5a3d22");
    px(wx + 10, wy + 2, 2, 2, "#f3ecc8"); px(wx + 2, wy + 7, 1, 1, "#cfd8ff"); px(wx + 4, wy + 2, 1, 1, "#cfd8ff");
    // 진영 깃발 둘
    const fx = wx + 22;
    if (fx + 16 < W - 24) {
      px(fx, 4, 6, 10, "#2f5fb3"); px(fx, 4, 6, 1, "#e6c36a"); px(fx + 2, 7, 2, 3, "#e6c36a"); px(fx + 1, 14, 1, 1, "#2f5fb3"); px(fx + 4, 14, 1, 1, "#2f5fb3");
      px(fx + 9, 4, 6, 10, "#9b2323"); px(fx + 9, 4, 6, 1, "#1c1c1c"); px(fx + 11, 7, 2, 3, "#1c1c1c"); px(fx + 10, 14, 1, 1, "#9b2323"); px(fx + 13, 14, 1, 1, "#9b2323");
    }
    // 벽난로 (오른쪽)
    const hx = W - 20, hy = wallH - 15;
    px(hx - 2, hy - 2, 18, 19, "#5b5650"); px(hx - 2, hy - 2, 18, 2, "#6d675f");
    px(hx + 2, hy + 4, 10, 11, "#120c08");
    if (fire.length === 0 || Math.random() < 0.35) {
      fire = [];
      for (let i = 0; i < 12; i++) fire.push([hx + 3 + Math.floor(Math.random() * 8), hy + 8 + Math.floor(Math.random() * 7), Math.random()]);
    }
    for (const [x, y, c] of fire) px(x, y, 1, 1, c < 0.4 ? "#ffd84a" : c < 0.8 ? "#ff8a2a" : "#d23a1a");
    px(hx + 3, hy + 14, 8, 1, "#ffb347");
    // 바 (왼쪽): 선반·병·카운터
    px(0, wallH - 16, barW, 1, "#5a3d22");
    const bottles = ["#3f8f4f", "#8a2f2f", "#c9a24c", "#2f6f9f", "#6b3f8f"];
    for (let i = 0, x = 2; x < barW - 2; x += 4, i++) { const c = bottles[i % bottles.length]; px(x, wallH - 20, 2, 4, c); px(x + 0.5, wallH - 21, 1, 1, c); }
    px(0, wallH + 1, barW, 2, "#8a5a32"); px(0, wallH + 3, barW, 8, "#5a3a1e");
    for (let x = 4; x < barW; x += 6) px(x, wallH + 4, 1, 6, "#4a2f17");
    px(barW - 6, wallH - 1, 3, 2, "#c9a24c"); px(barW - 6, wallH - 2, 3, 1, "#fff3d6");   // 맥주잔
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
  function person(a, now) {
    let pose = "stand";
    if (a.asleep) pose = "sit";
    else if (a.emote && /(인사|안녕|손|경례|환영|작별|잘가)/.test(a.emote.key)) pose = Math.floor(now / 220) % 2 ? "wave" : "stand";
    else if (a.walking) pose = Math.floor(now / 170) % 2 ? "walk1" : "walk2";
    const sp = spriteOf(a, pose);
    let x = Math.round(a.x), y = Math.round(a.y);
    if (a.emote && /춤/.test(a.emote.key)) y -= Math.round(Math.abs(Math.sin(now / 110)) * 3);
    if (!a.verified && !a.asleep) x += Math.round(Math.sin(now / 380 + a.seed) * 1.4);
    if (pose === "stand" && Math.floor(now / 650 + a.seed) % 2 === 0) y += 0; else if (pose === "stand") y += 1;
    g.globalAlpha = a.alpha * 0.32; g.fillStyle = "#000"; g.fillRect(Math.round(a.x) - 5, Math.round(a.y) + 1, 11, 1); g.fillRect(Math.round(a.x) - 3, Math.round(a.y) + 2, 7, 1);
    g.globalAlpha = a.alpha;
    drawSprite(sp, x, y, a.dir || 1);
    g.globalAlpha = 1;
    a.h = FEET - sp.top;
    return y - (FEET - sp.top);
  }
  const fairyFrames = [buildFairy(false, false), buildFairy(false, true), buildFairy(true, false)];
  function fairy(now) {
    const x = Math.round(bot.x), y = Math.round(bot.y);
    const flap = Math.floor(now / 130) % 2;
    // 날개 (반투명)
    g.globalAlpha = 0.65; g.fillStyle = "#bfe9ff";
    if (flap) { g.fillRect(x - 9, y - 12, 4, 3); g.fillRect(x - 8, y - 9, 3, 2); g.fillRect(x + 6, y - 12, 4, 3); g.fillRect(x + 6, y - 9, 3, 2); }
    else { g.fillRect(x - 7, y - 15, 3, 5); g.fillRect(x - 6, y - 10, 2, 2); g.fillRect(x + 5, y - 15, 3, 5); g.fillRect(x + 5, y - 10, 2, 2); }
    g.globalAlpha = 1;
    const blink = Math.floor(now / 2600) % 7 === 0 && (now % 2600) < 180;
    const fr = fairyFrames[blink ? 2 : Math.floor(now / 300) % 2];
    g.drawImage(fr.can, x - 7, y - 17);
    if (Math.random() < 0.5) { g.fillStyle = "#fff3b0"; g.fillRect(x + Math.round(rnd(-9, 9)), y + Math.round(rnd(-16, 2)), 1, 1); }
    return y - 17 + fr.top;
  }

  /* ---------- 고해상도 글자 (이름·말풍선) ---------- */
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
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
  function bubble(cx, bottomY, b) {
    const c = ctx, fs = 12 * dpr, pad = 6 * dpr, maxW = Math.min(160 * dpr, canvas.width * 0.62);
    c.font = `${b.foreign ? "italic " : ""}${fs}px system-ui, sans-serif`;
    const lines = wrap(c, b.text, maxW - pad * 2, 2);
    const w = Math.max(...lines.map((l) => c.measureText(l).width)) + pad * 2, h = lines.length * fs * 1.3 + pad * 1.4;
    let x = cx - w / 2; x = Math.max(3 * dpr, Math.min(canvas.width - w - 3 * dpr, x));
    const y = Math.max(2 * dpr, bottomY - h - 5 * dpr);
    c.fillStyle = b.bot ? "#2a2112" : "#f6ecd6"; c.strokeStyle = b.bot ? "#e6c36a" : "#00000055"; c.lineWidth = 1.2 * dpr;
    rr(c, x, y, w, h, 7 * dpr); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(cx - 4 * dpr, y + h - 0.5); c.lineTo(cx, y + h + 5 * dpr); c.lineTo(cx + 4 * dpr, y + h - 0.5); c.fill();
    c.fillStyle = b.bot ? "#f1dfae" : b.foreign ? "#6d6354" : "#1a1208"; c.textBaseline = "top"; c.textAlign = "left";
    lines.forEach((l, i) => c.fillText(l, x + pad, y + pad * 0.7 + i * fs * 1.3));
  }
  function label(cx, y, text, color, dim, bold) {
    const c = ctx; c.font = `${bold ? "700 " : "600 "}${10 * dpr}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "bottom";
    c.globalAlpha = dim ? 0.55 : 0.95; c.fillStyle = "#000a"; c.fillText(text, cx + dpr, y + dpr); c.fillStyle = color; c.fillText(text, cx, y); c.globalAlpha = 1;
  }

  function draw(now) {
    if (!low.width) return;
    g.clearRect(0, 0, W, H);
    room(now);
    const list = [...people.values()].sort((a, b) => a.y - b.y);
    const tops = new Map();
    for (const a of list) tops.set(a.id, person(a, now));
    const fairyTop = fairy(now);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(low, 0, 0, W * k, H * k);
    // 이름표
    for (const a of list) {
      if (a.alpha <= 0.05) continue;
      const top = tops.get(a.id) - 1;
      label(a.x * k, top * k, a.name || "", classColor[a.cls] || "#ddd", a.asleep, a.id === meId);
      if (a.asleep) {
        const t = (now / 900 + a.seed) % 1;
        ctx.font = `700 ${9 * dpr}px system-ui`; ctx.fillStyle = `rgba(200,210,255,${0.8 - t * 0.7})`;
        ctx.fillText("z", (a.x + 3 + t * 3) * k, (top - 3 - t * 5) * k);
      }
      if (a.emote && emoteEmoji[a.emote.key]) {
        ctx.font = `${16 * dpr}px system-ui`; ctx.textAlign = "center";
        ctx.fillText(emoteEmoji[a.emote.key], a.x * k, (top - 4) * k - 10 * dpr);
      }
    }
    label(bot.x * k, (fairyTop - 1) * k, "포에버봇", "#e6c36a", false, false);
    // 말풍선은 맨 위에
    for (const a of list) if (a.bubble && a.alpha > 0.3) bubble(a.x * k, (tops.get(a.id) - 1) * k - 11 * dpr, a.bubble);
    if (bot.bubble) bubble(bot.x * k, (fairyTop - 1) * k - 11 * dpr, bot.bubble);
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
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    const lx = (e.clientX - r.left) / PX, ly = (e.clientY - r.top) / PX;
    if (Math.abs(lx - bot.x) < 9 && ly > bot.y - 18 && ly < bot.y + 3) { opts.onTap?.({ bot: true }); return; }
    const list = [...people.values()].filter((a) => a.alpha > 0.3).sort((a, b) => b.y - a.y);
    for (const a of list) {
      if (Math.abs(lx - a.x) < 8 && ly <= a.y + 2 && ly >= a.y - (a.h || 22) - 2) { opts.onTap?.(a); return; }
    }
  });

  return {
    setPeople, say, setRunning,
    setMe(id) { meId = id; },
    // 자리 고정 (그림 확인용): 화면 비율 0~1로
    place(id, fx, fy, dir = 1) {
      const a = people.get(id); if (!a) return; const r = area();
      a.x = a.tx = r.x0 + (r.x1 - r.x0) * fx; a.y = a.ty = r.y0 + (r.y1 - r.y0) * fy;
      a.dir = dir; a.alpha = 1; a.nextMove = Infinity;
    },
    reset() { people.clear(); bot.bubble = null; firstFill = true; },
    resize,
    destroy() { setRunning(false); ro.disconnect(); },
  };
}
