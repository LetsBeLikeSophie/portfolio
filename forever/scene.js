// 포에버 채팅 - 위쪽 여관 장면 (도트 캐릭터가 돌아다니고 말풍선이 뜸)
// 그림은 모두 코드로 찍은 우리 도트예요 (게임 그림을 가져오지 않음). 종족은 키·귀·뿔·피부색, 직업은 옷 색, 진영은 망토 색.
// 포에버봇은 로봇 머리를 한 작은 요정으로 바 위를 떠다녀요.

const PX = 4;              // 화면 1px 도트 = CSS 4px
const FPS = 20;
const SKIN = {
  "인간":            { legs: 4, torso: 5, tw: 6, head: 4, hw: 5, skin: "#e8b98f", hair: "#6b4423" },
  "드워프":          { legs: 2, torso: 5, tw: 7, head: 4, hw: 5, skin: "#e3a982", hair: "#a0522d", beard: true },
  "노움":            { legs: 2, torso: 3, tw: 5, head: 5, hw: 6, skin: "#f2cba4", hair: "#ff7fbf", tufts: true },
  "나이트 엘프":     { legs: 5, torso: 6, tw: 6, head: 4, hw: 5, skin: "#9a86dc", hair: "#2fb3a4", ears: true },
  "고등 마법원 스카이본": { legs: 4, torso: 5, tw: 6, head: 4, hw: 5, skin: "#cfe3f5", hair: "#ffd76a", crest: true, wing: "#eef6ff" },
  "오크":            { legs: 4, torso: 6, tw: 8, head: 4, hw: 5, skin: "#5f9e3f", hair: "#1c1c1c", tusks: true, topknot: true },
  "언데드":          { legs: 4, torso: 5, tw: 5, head: 4, hw: 5, skin: "#a2b3a0", hair: "#3a3a3a", glow: true },
  "타우렌":          { legs: 4, torso: 7, tw: 9, head: 5, hw: 6, skin: "#7a5230", hair: "#4a3020", horns: true },
  "트롤":            { legs: 5, torso: 5, tw: 6, head: 4, hw: 5, skin: "#4f8fb0", hair: "#d0402a", tusks: true, mohawk: true },
  "바람구체자 스카이본": { legs: 4, torso: 5, tw: 6, head: 4, hw: 5, skin: "#b4a4dc", hair: "#ff8a4a", crest: true, wing: "#f3e2ff" },
};
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
    bot.x = barW / 2 + Math.sin(now / 1700) * 3; bot.y = wallH - 6 + Math.sin(now / 420) * 1.5;
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

  function charHeight(s) { return s.legs + s.torso + s.head; }
  function person(a, now) {
    const s = SKIN[a.race] || (a.faction === "horde" ? SKIN["오크"] : SKIN["인간"]);
    const cloth = classColor[a.cls] || "#9c8d77";
    const dir = a.dir || 1;
    let x = Math.round(a.x), y = Math.round(a.y);
    let legs = a.asleep ? 1 : s.legs;
    // 춤: 통통 / 취객: 비틀 / 서 있을 때 숨쉬기
    if (a.emote && /춤/.test(a.emote.key)) y -= Math.round(Math.abs(Math.sin(now / 110)) * 3);
    if (!a.verified && !a.asleep) x += Math.round(Math.sin(now / 380 + a.seed) * 1.2);
    const breathe = !a.walking && !a.asleep && Math.floor((now / 600) + a.seed) % 2 === 0 ? 1 : 0;
    const top = y - legs - s.torso - s.head + breathe;
    const cx = x;
    // 그림자
    g.globalAlpha = a.alpha * 0.35; px(cx - 4, y, 9, 1, "#000"); g.globalAlpha = a.alpha;
    // 다리 (걸을 때 번갈아)
    const f = a.walking ? Math.floor(now / 160) % 2 : 0;
    const lx = cx - 2, rx = cx + 1;
    px(lx, y - legs + (f ? 1 : 0), 2, legs - (f ? 1 : 0), "#3b2f25");
    px(rx, y - legs + (f ? 0 : 0), 2, legs - (a.walking && !f ? 1 : 0), "#3b2f25");
    px(lx, y - 1, 2, 1, "#1f160e"); px(rx, y - 1, 2, 1, "#1f160e");
    // 망토 (진영 색, 등 쪽)
    const tl = cx - Math.floor(s.tw / 2), tt = y - legs - s.torso + breathe;
    px(dir > 0 ? tl - 1 : tl + s.tw, tt + 1, 1, s.torso + (a.asleep ? 0 : 1), FACTION_CAPE[a.faction] || "#555");
    // 스카이본 날개
    if (s.wing) px(dir > 0 ? tl - 2 : tl + s.tw + 1, tt, 1, 3, s.wing);
    // 몸통 (직업 색) + 허리띠
    px(tl, tt, s.tw, s.torso, cloth); px(tl, tt + s.torso - 1, s.tw, 1, "#2a2015");
    // 팔·손
    const hand = dir > 0 ? tl + s.tw : tl - 1;
    const wave = a.emote && /(인사|안녕|손|경례|환영)/.test(a.emote.key) && Math.floor(now / 200) % 2 === 0;
    if (wave) { px(hand, tt - 3, 1, 3, cloth); px(hand, tt - 4, 1, 1, s.skin); }
    else { px(hand, tt + 1, 1, s.torso - 2, cloth); px(hand, tt + s.torso - 1, 1, 1, s.skin); }
    // 취객: 맥주잔
    if (!a.verified && !a.asleep && !wave) { const mx = dir > 0 ? hand + 1 : hand - 2; px(mx, tt + s.torso - 3, 2, 2, "#c9a24c"); px(mx, tt + s.torso - 4, 2, 1, "#fff3d6"); }
    // 머리
    const hl = cx - Math.floor(s.hw / 2), ht = top;
    px(hl, ht, s.hw, s.head, s.skin);
    px(hl, ht, s.hw, 1, s.hair);
    const eyeY = ht + Math.floor(s.head / 2), eyeX = dir > 0 ? hl + s.hw - 2 : hl + 1;
    px(eyeX, eyeY, 1, 1, a.asleep ? s.skin : s.glow ? "#ffd84a" : "#141010");
    if (a.asleep) px(eyeX - (dir > 0 ? 0 : 0), eyeY, 1, 1, "#3a2a20");
    if (!a.verified && !a.asleep) px(dir > 0 ? eyeX - 1 : eyeX + 1, eyeY + 1, 1, 1, "#e0606a");   // 빨간 볼
    if (s.ears) { px(hl - 1, eyeY - 1, 1, 1, s.skin); px(hl - 2, eyeY - 2, 1, 1, s.skin); px(hl + s.hw, eyeY - 1, 1, 1, s.skin); px(hl + s.hw + 1, eyeY - 2, 1, 1, s.skin); }
    if (s.horns) { px(hl - 1, ht, 1, 1, "#efe6cf"); px(hl - 2, ht - 1, 1, 1, "#efe6cf"); px(hl + s.hw, ht, 1, 1, "#efe6cf"); px(hl + s.hw + 1, ht - 1, 1, 1, "#efe6cf"); px(dir > 0 ? hl + s.hw - 1 : hl, ht + s.head - 1, 1, 1, "#c9a24c"); }
    if (s.tusks) px(dir > 0 ? hl + s.hw - 1 : hl, ht + s.head - 1, 1, 1, "#f4f0e0");
    if (s.beard) { px(hl, ht + s.head - 2, s.hw, 2, s.hair); px(tl + 1, tt, s.tw - 2, 2, s.hair); px(eyeX, eyeY, 1, 1, "#141010"); }
    if (s.tufts) { px(hl - 1, ht + 1, 1, 2, s.hair); px(hl + s.hw, ht + 1, 1, 2, s.hair); }
    if (s.topknot) { px(cx, ht - 2, 1, 2, s.hair); }
    if (s.mohawk) { px(cx - 1, ht - 1, 2, 1, s.hair); px(cx, ht - 3, 1, 2, s.hair); }
    if (s.crest) { px(cx - 1, ht - 1, 1, 1, s.hair); px(cx, ht - 3, 1, 3, s.hair); px(cx + 1, ht - 2, 1, 2, s.hair); }
    g.globalAlpha = 1;
    return top;
  }

  function fairy(now) {
    const x = Math.round(bot.x), y = Math.round(bot.y);
    const flap = Math.floor(now / 140) % 2;
    g.globalAlpha = 0.7;
    if (flap) { px(x - 5, y - 3, 3, 2, "#bfe9ff"); px(x + 3, y - 3, 3, 2, "#bfe9ff"); px(x - 4, y - 1, 2, 1, "#bfe9ff"); px(x + 3, y - 1, 2, 1, "#bfe9ff"); }
    else { px(x - 4, y - 4, 2, 3, "#bfe9ff"); px(x + 3, y - 4, 2, 3, "#bfe9ff"); }
    g.globalAlpha = 1;
    // 드레스
    px(x - 1, y - 1, 3, 1, "#e6c36a"); px(x - 1, y, 4, 1, "#e6c36a"); px(x - 2, y + 1, 5, 1, "#d9b04f");
    px(x - 1, y + 2, 1, 1, "#e8b98f"); px(x + 1, y + 2, 1, 1, "#e8b98f");
    // 로봇 머리
    px(x - 2, y - 6, 5, 5, "#c9d2dc"); px(x - 2, y - 6, 5, 1, "#e3e9ef");
    px(x - 1, y - 4, 1, 1, "#4fd1ff"); px(x + 1, y - 4, 1, 1, "#4fd1ff"); px(x - 1, y - 2, 3, 1, "#6b7785");
    px(x - 3, y - 4, 1, 2, "#9aa5b1"); px(x + 3, y - 4, 1, 2, "#9aa5b1");
    px(x, y - 8, 1, 2, "#9aa5b1"); px(x, y - 9, 1, 1, Math.floor(now / 300) % 2 ? "#ffd84a" : "#fff3b0");
    // 반짝이
    if (Math.random() < 0.5) px(x + Math.round(rnd(-6, 6)), y + Math.round(rnd(-8, 4)), 1, 1, "#fff3b0");
    return y - 9;
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
    if (Math.abs(lx - bot.x) < 7 && ly > bot.y - 11 && ly < bot.y + 5) { opts.onTap?.({ bot: true }); return; }
    const list = [...people.values()].filter((a) => a.alpha > 0.3).sort((a, b) => b.y - a.y);
    for (const a of list) {
      const s = SKIN[a.race] || SKIN["인간"], h = charHeight(s) + 3;
      if (Math.abs(lx - a.x) < 6 && ly <= a.y + 1 && ly >= a.y - h) { opts.onTap?.(a); return; }
    }
  });

  return {
    setPeople, say, setRunning,
    setMe(id) { meId = id; },
    reset() { people.clear(); bot.bubble = null; firstFill = true; },
    resize,
    destroy() { setRunning(false); ro.disconnect(); },
  };
}
