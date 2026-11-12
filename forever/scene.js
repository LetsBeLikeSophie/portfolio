// 포에버 채팅 - 위쪽 여관 장면 (도트 캐릭터가 돌아다니고 말풍선이 뜸)
// 그림은 모두 코드로 찍은 우리 도트예요 (게임 그림을 가져오지 않음). 종족은 키·귀·뿔·피부색, 직업은 옷 색, 진영은 망토 색.
// 포에버봇은 로봇 머리를 한 작은 요정으로 바 위를 떠다녀요.

import { buildSprite, buildFairy, buildDrunk, GW, FEET, CX } from "./sprites.js?v=4";

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
  let meId = null, running = false, raf = 0, last = 0, firstFill = true, bg = null;

  /* ---------- 크기 ---------- */
  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    W = Math.max(60, Math.floor(r.width / PX)); H = Math.max(40, Math.floor(r.height / PX));
    low.width = W; low.height = H; k = PX * dpr;
    wallH = Math.round(H * 0.4); barW = 20;
    bg = makeBg();
    for (const a of people.values()) clampPos(a);
    draw(performance.now());
  }
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  const area = () => ({ x0: 8, x1: W - 8, y0: wallH + 10, y1: H - 3 });
  function clampPos(a) {
    const r = area();
    a.x = Math.min(r.x1, Math.max(r.x0, a.x)); a.y = Math.min(r.y1, Math.max(r.y0, a.y));
    a.tx = Math.min(r.x1, Math.max(r.x0, a.tx ?? a.x)); a.ty = Math.min(r.y1, Math.max(r.y0, a.ty ?? a.y));
  }
  function restSpot(a) {
    const r = area(), h = hash(a.id);
    return { x: r.x0 + 6 + (h % Math.max(1, r.x1 - r.x0 - 12)), y: r.y0 + 4 + ((h >> 8) % Math.max(1, r.y1 - r.y0 - 4)) };
  }

  /* ---------- 사람 목록 ---------- */
  function upsert(p, { walkIn = false } = {}) {
    let a = people.get(p.id); const isNew = !a;
    if (!a) {
      const r = area(), h = hash(p.id);
      a = { id: p.id, seed: (h % 1000) / 160, nextMove: performance.now() + rnd(500, 4000), dir: h & 1 ? 1 : -1, alpha: 0, gone: false };
      if (walkIn) { a.x = W + 4; a.y = rnd(r.y0, r.y1); a.tx = rnd(r.x0 + 10, r.x1 - 6); a.ty = a.y; a.dir = -1; }
      else { a.x = rnd(r.x0, r.x1); a.y = rnd(r.y0, r.y1); a.tx = a.x; a.ty = a.y; if (firstFill) a.alpha = 1; }
      people.set(p.id, a);
    }
    Object.assign(a, { name: p.name, race: p.race, cls: p.cls, faction: p.faction, verified: p.verified !== false,
      level: p.level, realm: p.realm, gone: false });
    const wasAsleep = a.asleep; a.asleep = !!p.asleep;
    if (a.asleep && !wasAsleep) { const s = restSpot(a); a.tx = s.x; a.ty = s.y; if (isNew) { a.x = s.x; a.y = s.y; } }
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
      a.alpha = a.gone ? Math.max(0, a.alpha - dt * 1.5) : Math.min(1, a.alpha + dt * 2);
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

  /* ---------- 배경: 움직이지 않는 부드러운 그림 한 장 (크기 바뀔 때만 다시) ---------- */
  function makeBg() {
    const b = document.createElement("canvas"); b.width = canvas.width; b.height = canvas.height;
    const c = b.getContext("2d"), wy = wallH * k, cw = b.width, ch = b.height;
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
  function person(a, now) {
    // 취객(손님)은 종족과 상관없이 술 취한 유령
    if (!a.verified) {
      const sleep = a.asleep && !a.walking, fr = Math.floor(now / 260) % 2;
      const key = "drunk|" + (sleep ? "s" : fr);
      let sp = cache.get(key); if (!sp) { sp = buildDrunk(sleep ? 0 : fr, sleep); cache.set(key, sp); }
      const x = Math.round(a.x + (sleep ? 0 : Math.sin(now / 380 + a.seed) * 1.6));
      const y = Math.round(a.y - 2 + (sleep ? 0 : Math.sin(now / 520 + a.seed) * 1.5));
      g.globalAlpha = a.alpha * 0.25; g.fillStyle = "#000"; g.fillRect(Math.round(a.x) - 5, Math.round(a.y) + 1, 11, 1);
      g.globalAlpha = a.alpha; drawSprite(sp, x, y, a.dir || 1); g.globalAlpha = 1;
      a.h = FEET - sp.top + 2;
      return y - (FEET - sp.top);
    }
    if (a.asleep && !a.walking) {
      const sp = spriteOf(a, "sleep"), x = Math.round(a.x), y = Math.round(a.y);
      g.globalAlpha = a.alpha * 0.3; g.fillStyle = "#000"; g.fillRect(x - 13, y + 1, 26, 1);
      g.globalAlpha = a.alpha;
      g.save(); g.translate(x, y); g.rotate(-Math.PI / 2);
      g.drawImage(sp.can, -(CX - 7), 11 - FEET);
      g.restore(); g.globalAlpha = 1;
      a.h = 14;
      return y - 14;
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
  function bubble(cx, bottomY, b) {
    const c = ctx, u = 2 * dpr, fs = 11 * dpr, lh = 15 * dpr, pad = 5 * u, maxW = Math.min(170 * dpr, canvas.width * 0.66);
    const snap = (v) => Math.round(v / u) * u;
    c.font = font(fs);
    const lines = wrap(c, b.text, maxW - pad * 2, 2);
    const w = snap(Math.max(...lines.map((l) => c.measureText(l).width)) + pad * 2), h = snap(lines.length * lh + 3 * u * 2);
    cx = snap(cx);
    let x = snap(cx - w / 2); x = Math.max(u * 2, Math.min(canvas.width - w - u * 2, x));
    const y = snap(Math.max(u, bottomY - h - 3 * u));
    const line = b.bot ? "#e6c36a" : "#1a110a", fill = b.bot ? "#2a2112" : "#f7ecd2";
    // 그림자 → 상자 → 꼬리
    pixBox(c, x + u, y + u, w, h, u, "rgba(0,0,0,.35)", "rgba(0,0,0,.35)");
    pixBox(c, x, y, w, h, u, line, fill);
    if (!b.bot) { c.fillStyle = "rgba(255,255,255,.55)"; c.fillRect(x + 2 * u, y + u, w - 4 * u, u); }
    const tx = Math.max(x + 3 * u, Math.min(x + w - 4 * u, cx - u));
    c.fillStyle = fill; c.fillRect(tx, y + h - u, 2 * u, u); c.fillRect(tx, y + h, 2 * u, u);
    c.fillStyle = line; c.fillRect(tx - u, y + h, u, u); c.fillRect(tx + 2 * u, y + h, u, u); c.fillRect(tx, y + h + u, 2 * u, u);
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
    g.clearRect(0, 0, W, H);
    const list = [...people.values()].sort((a, b) => a.y - b.y);
    const tops = new Map();
    for (const a of list) tops.set(a.id, person(a, now));
    const fairyTop = fairy(now);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (bg) ctx.drawImage(bg, 0, 0);
    ctx.drawImage(low, 0, 0, W * k, H * k);
    // 이름표
    for (const a of list) {
      if (a.alpha <= 0.05) continue;
      const top = tops.get(a.id) - 1;
      label(a.x * k, top * k, a.name || "", a.verified ? (classColor[a.cls] || "#ddd") : "#d9d3ff", false, a.id === meId);
      if (!a.verified && !a.asleep) {   // 가끔 딸꾹!
        const ph = (now / 1000 + a.seed * 3) % 7;
        if (ph < 1.2) {
          ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.globalAlpha = Math.max(0, 1 - ph / 1.2);
          outlined("딸꾹!", (a.x + 6) * k, top * k - (13 + ph * 8) * dpr, "#ffb3c1", 11);
          ctx.globalAlpha = 1;
        }
      }
      if (a.asleep && !a.walking) {
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        for (let i = 0; i < 3; i++) {
          const t = ((now / 1400 + a.seed) + i / 3) % 1;
          ctx.globalAlpha = Math.max(0, Math.min(1, 1.2 - t));
          const zx = a.verified ? a.x - 12 : a.x + 7, zy = a.verified ? a.y - 8 : top + 3;
          outlined("Z", Math.round((zx - t * 4) * k), Math.round((zy - t * 9) * k), "#c9d4ff", t < 0.5 ? 11 : 22);
          ctx.globalAlpha = 1;
        }
      }
      if (a.emote && emoteEmoji[a.emote.key]) {
        ctx.font = `${16 * dpr}px system-ui`; ctx.textAlign = "center";
        ctx.fillText(emoteEmoji[a.emote.key], a.x * k, (top - 4) * k - 10 * dpr);
      }
    }
    label(bot.x * k, (fairyTop - 1) * k, "포에버봇", "#e6c36a", false, false);
    // 말풍선은 맨 위에
    for (const a of list) if (a.bubble && a.alpha > 0.3) bubble(a.x * k, (tops.get(a.id) - 1) * k - 13 * dpr, a.bubble);
    if (bot.bubble) bubble(bot.x * k, (fairyTop - 1) * k - 13 * dpr, bot.bubble);
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
      const hw = a.asleep && !a.walking ? 14 : 8;
      if (Math.abs(lx - a.x) < hw && ly <= a.y + 2 && ly >= a.y - (a.h || 22) - 2) { opts.onTap?.(a); return; }
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
