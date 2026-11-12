// 포에버 채팅 - 여관 캐릭터 도트 (2등신, 테두리·명암). 모두 직접 찍은 그림이에요.
// 칸 하나 = 도트 1개. 오른쪽을 보는 모습으로 만들고, 왼쪽은 화면에서 뒤집어 그려요.

export const GW = 24, GH = 30, FEET = GH - 1, CX = 11;
const OUT = "#1a110a";

export function shade(hex, f) {
  const n = parseInt(String(hex).slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f < 1) { r *= f; g *= f; b *= f; } else { r += (255 - r) * (f - 1); g += (255 - g) * (f - 1); b += (255 - b) * (f - 1); }
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

// 종족: 머리(hw×hh)·몸(bw×bh)·다리(lh) 크기와 특징
export const RACE = {
  "인간":     { skin: "#eab48c", hair: "#6b4423", hw: 10, hh: 9, bw: 8, bh: 6, lh: 4, hair_: "short", ear: "round" },
  "드워프":   { skin: "#e3a37c", hair: "#b5642a", hw: 10, hh: 9, bw: 10, bh: 6, lh: 2, hair_: "short", ear: "round", beard: true, nose: 1 },
  "노움":     { skin: "#f4cfa8", hair: "#ff6fb5", hw: 11, hh: 10, bw: 6, bh: 4, lh: 2, hair_: "pigtails", ear: "round" },
  "나이트 엘프": { skin: "#9c83dd", hair: "#33c2b0", hw: 9, hh: 9, bw: 8, bh: 7, lh: 6, hair_: "long", ear: "elf", eye: "#e9f6ff" },
  "고등 마법원 스카이본": { skin: "#d8e8f6", hair: "#ffd25a", hw: 10, hh: 9, bw: 8, bh: 6, lh: 4, hair_: "crest", ear: "none", wing: "#f4f8ff" },
  "오크":     { skin: "#5f9e3f", hair: "#1c1c1c", hw: 10, hh: 8, bw: 10, bh: 7, lh: 4, hair_: "topknot", ear: "point", tusks: 1, brow: true },
  "언데드":   { skin: "#9fb39c", hair: "#2e2a2a", hw: 9, hh: 9, bw: 7, bh: 6, lh: 5, hair_: "stringy", ear: "round", eye: "#ffd84a", jaw: true },
  "타우렌":   { skin: "#7a5230", hair: "#3d2616", hw: 11, hh: 9, bw: 12, bh: 8, lh: 4, hair_: "mane", ear: "side", horns: true, snout: true, hoof: true },
  "트롤":     { skin: "#4f8fb0", hair: "#e0452a", hw: 9, hh: 9, bw: 8, bh: 6, lh: 6, hair_: "mohawk", ear: "troll", tusks: 2, nose: 2 },
  "바람구체자 스카이본": { skin: "#b6a3de", hair: "#ff8a3d", hw: 10, hh: 9, bw: 8, bh: 6, lh: 4, hair_: "crest", ear: "none", wing: "#f3e2ff" },
};
const KIND = { "전사": "plate", "성기사": "plate", "마법사": "robe", "사제": "robe", "흑마법사": "robe", "도적": "rogue", "사냥꾼": "hunter", "주술사": "mail", "드루이드": "leather" };
const CAPE = { alliance: "#2f5fb3", horde: "#a32626" };

function grid(w, h) {
  const a = Array.from({ length: h }, () => new Array(w).fill(null));
  const set = (x, y, c) => { if (c && x >= 0 && x < w && y >= 0 && y < h) a[y][x] = c; };
  const rect = (x, y, rw, rh, c) => { for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) set(x + i, y + j, c); };
  const has = (x, y) => x >= 0 && x < w && y >= 0 && y < h && a[y][x] != null;
  return { a, w, h, set, rect, has };
}
// 테두리를 두르고 캔버스로
function toCanvas(G, outline = true) {
  const can = document.createElement("canvas"); can.width = G.w; can.height = G.h;
  const c = can.getContext("2d"); let top = G.h;
  for (let y = 0; y < G.h; y++) for (let x = 0; x < G.w; x++) {
    let col = G.a[y][x];
    if (!col && outline && (G.has(x - 1, y) || G.has(x + 1, y) || G.has(x, y - 1) || G.has(x, y + 1))) col = OUT;
    if (col) { c.fillStyle = col; c.fillRect(x, y, 1, 1); if (y < top) top = y; }
  }
  return { can, top };
}

/* pose: stand | walk1 | walk2 | sit | wave */
export function buildSprite(raceName, cls, faction, pose, drunk, clothHex) {
  const R = RACE[raceName] || (faction === "horde" ? RACE["오크"] : RACE["인간"]);
  const G = grid(GW, GH), { set, rect } = G;
  const kind = KIND[cls] || "leather";
  const c = clothHex || "#9c8d77";
  const C = shade(c, c.toLowerCase() === "#ffffff" ? 0.8 : 0.7), L = shade(c, 1.3), D = shade(c, 0.5);
  const s = R.skin, S = shade(s, 0.8), SS = shade(s, 0.62), h = R.hair, H = shade(h, 0.68), HL = shade(h, 1.3);
  const cape = CAPE[faction] || "#555", capeS = shade(cape, 0.7);
  const sit = pose === "sit";
  const lh = sit ? 1 : R.lh;
  const legTop = FEET - lh + 1;
  const tTop = legTop - R.bh;
  const tl = CX - Math.floor(R.bw / 2) + 1, tr = tl + R.bw - 1;
  const ht = tTop - R.hh + 1;
  const hl = CX - Math.floor(R.hw / 2) + 1, hr = hl + R.hw - 1;
  const eyeY = ht + Math.floor(R.hh / 2);

  // 날개 (스카이본) - 등 뒤
  if (R.wing) {
    const w = R.wing, wS = shade(w, 0.82), x0 = tl - 2;
    [[0, 0, 1], [-1, 1, 2], [-2, 2, 3], [-3, 3, 3], [-2, 4, 2], [-1, 5, 1]].forEach(([dx, dy, n]) => {
      for (let i = 0; i < n; i++) set(x0 + dx + i, tTop + dy - 1, i === 0 ? wS : w);
    });
  }
  // 망토 (진영 색)
  rect(tl - 1, tTop + 1, 1, R.bh + (sit ? 0 : 1), capeS);
  rect(tl - 2, tTop + 3, 1, Math.max(1, R.bh - 1 + (sit ? 0 : 1)), cape);
  // 화살통 (사냥꾼)
  if (kind === "hunter") {
    for (let i = 0; i < 6; i++) set(tl - 3 + Math.floor(i / 2), tTop - 2 + i, i < 2 ? "#e8e0d0" : "#7a5230");
    set(tl - 4, tTop - 3, "#d24a3a"); set(tl - 2, tTop - 3, "#d24a3a");
  }

  // 다리
  const pants = R.hoof ? shade(s, 0.75) : "#4a3a2c", pantsS = shade(pants, 0.72);
  const boot = R.hoof ? "#2b2420" : "#6a4428", bootS = shade(boot, 0.7);
  const leg = (x, lift, back) => {
    const y1 = FEET - lift;
    rect(x, legTop - lift, 3, y1 - (legTop - lift), back ? pantsS : pants);
    set(x + 2, legTop - lift, back ? shade(pantsS, 0.85) : pantsS);
    rect(x, y1, 3, 1, back ? bootS : boot); set(x + 3, y1, back ? bootS : boot);
  };
  if (kind === "robe" && !sit) {
    const f1 = pose === "walk1" ? 1 : 0, f2 = pose === "walk2" ? 1 : 0;
    rect(CX - 2 + f2, FEET, 2, 1, bootS); rect(CX + 2 - f1, FEET, 3, 1, boot);
  } else if (sit) {
    rect(CX - 2, FEET - 1, 6, 2, pants); rect(CX + 4, FEET - 2, 2, 3, boot);
  } else {
    leg(CX - 3, pose === "walk1" ? 1 : 0, true);
    leg(CX + 1, pose === "walk2" ? 1 : 0, false);
  }

  // 몸통
  if (kind === "robe") {
    const bottom = sit ? FEET : FEET - 1;
    rect(tl, tTop, R.bw, bottom - tTop + 1, c);
    rect(tl - 1, bottom - 1, 1, 2, c); rect(tr + 1, bottom - 1, 1, 2, C);
    rect(tr - 1, tTop, 2, bottom - tTop + 1, C); rect(tl, tTop, 1, bottom - tTop - 1, L);
    rect(CX + 1, tTop + 2, 1, bottom - tTop - 1, cls === "사제" ? "#e6c36a" : L);
    rect(tl, tTop + R.bh - 1, R.bw, 1, cls === "흑마법사" ? "#5a2a7a" : "#e6c36a");
  } else {
    rect(tl, tTop, R.bw, R.bh, c);
    rect(tr - 1, tTop, 2, R.bh, C); rect(tl, tTop, 1, R.bh - 1, L);
    rect(tl, tTop + R.bh - 1, R.bw, 1, "#3e2a18"); set(CX + 1, tTop + R.bh - 1, "#e6c36a");
    if (kind === "mail") for (let y = tTop + 1; y < tTop + R.bh - 1; y += 2) for (let x = tl + 1 + (y & 1); x < tr - 1; x += 2) set(x, y, C);
    if (kind === "leather") { set(tl + 1, tTop + 1, "#4caf50"); set(tl + 2, tTop, "#6fd06f"); }
    if (kind === "rogue") { for (let i = 0; i < R.bh - 1; i++) set(tl + 1 + i, tTop + i, D); }
  }
  // 어깨 갑옷
  if (kind === "plate") { rect(tl - 1, tTop, 3, 2, "#aab4bf"); set(tl - 1, tTop, "#dfe5ea"); rect(tr - 1, tTop, 3, 2, "#8a94a0"); set(tr - 1, tTop, "#c5ccd3"); }
  if (kind === "mail") { rect(tr - 1, tTop, 3, 1, "#e6c36a"); }

  // 팔: 뒤쪽 팔(왼쪽)은 어둡게, 앞쪽 팔(오른쪽)
  const armTop = tTop + 1, armLen = Math.max(2, Math.min(R.bh - 1, 5));
  rect(tl - 1, armTop, 1, armLen, C); set(tl - 1, armTop + armLen, S);
  if (pose === "wave") {
    rect(tr + 1, tTop - 3, 2, 4, c); set(tr + 2, tTop - 3, C); rect(tr + 1, tTop - 5, 2, 2, s); set(tr + 2, tTop - 5, S);
  } else {
    rect(tr + 1, armTop, 2, armLen, c); rect(tr + 2, armTop, 1, armLen, C);
    rect(tr + 1, armTop + armLen, 2, 1, s); set(tr + 2, armTop + armLen, S);
    if (drunk) { // 맥주잔
      const my = armTop + armLen - 3;
      rect(tr + 2, my + 1, 3, 3, "#d9a63a"); rect(tr + 2, my, 3, 1, "#fff3d6"); set(tr + 3, my - 1, "#fff3d6");
      set(tr + 4, my + 2, "#b07e26"); set(tr + 5, my + 2, "#d9a63a"); set(tr + 5, my + 3, "#d9a63a");
    }
  }

  // 머리 (모서리 둥글게, 뒤통수·턱 그늘)
  const inHead = (x, y) => {
    if (y === 0 || y === R.hh - 1) return x >= 2 && x <= R.hw - 3;
    if (y === 1 || y === R.hh - 2) return x >= 1 && x <= R.hw - 2;
    return true;
  };
  for (let y = 0; y < R.hh; y++) for (let x = 0; x < R.hw; x++) {
    if (!inHead(x, y)) continue;
    set(hl + x, ht + y, x <= 1 || y === R.hh - 1 ? S : s);
  }
  set(hr - 1, ht + 2, shade(s, 1.12));   // 이마 반짝

  // 귀
  if (R.ear === "round") { set(hl - 1, eyeY, s); set(hl - 1, eyeY + 1, S); set(hl, eyeY + 1, SS); }
  if (R.ear === "elf") [[-1, 0], [-2, -1], [-3, -2], [-4, -3], [-5, -4], [-2, 0], [-3, -1]].forEach(([dx, dy], i) => set(hl + dx, eyeY + dy, i > 4 ? S : s));
  if (R.ear === "troll") [[-1, 0], [-2, -1], [-3, -2], [-4, -2], [-2, 0]].forEach(([dx, dy], i) => set(hl + dx, eyeY + dy, i > 3 ? S : s));
  if (R.ear === "point") { set(hl - 1, eyeY, s); set(hl - 2, eyeY - 1, s); set(hl - 1, eyeY + 1, S); }
  if (R.ear === "side") { set(hl - 1, eyeY, s); set(hl - 2, eyeY, s); set(hl - 3, eyeY + 1, S); set(hl - 1, eyeY + 1, S); }

  // 머리카락
  const hairTop = (rows, frontGap) => {
    for (let y = 0; y < rows; y++) for (let x = 0; x < R.hw; x++) {
      if (!inHead(x, y)) continue;
      if (y === rows - 1 && x > R.hw - 1 - frontGap) continue;
      set(hl + x, ht + y, x > R.hw - 4 && y < rows - 1 ? H : y === 0 && x < 4 ? HL : h);
    }
  };
  switch (R.hair_) {
    case "short": hairTop(3, 3); set(hr - 3, ht + 3, h); rect(hl, ht + 2, 2, 3, h); set(hl, ht + 5, H); break;
    case "long": hairTop(3, 3); set(hr - 3, ht + 3, h); rect(hl - 1, ht + 2, 3, R.hh + 2, h); rect(hl - 1, ht + R.hh, 1, 3, H); set(hl + 1, ht + R.hh + 3, H); break;
    case "pigtails": hairTop(3, 3); set(hr - 3, ht + 3, h); rect(hl - 3, ht + 3, 3, 4, h); set(hl - 3, ht + 3, HL); set(hl - 2, ht + 7, H); set(hl - 3, ht + 6, H);
      set(CX, ht - 1, h); set(CX + 1, ht - 2, h); set(CX + 2, ht - 2, HL); break;
    case "crest": hairTop(2, 2); rect(hl, ht + 2, 1, 3, h);
      [[3, 2], [5, 4], [7, 3]].forEach(([x, n]) => { for (let i = 1; i <= n; i++) set(hl + x, ht - i, i === n ? HL : h); set(hl + x + 1, ht - 1, H); });
      break;
    case "topknot": hairTop(1, 0); rect(CX - 1, ht - 2, 3, 2, h); set(CX, ht - 3, h); rect(hl - 1, ht + 1, 1, 4, h); set(hl - 2, ht + 4, H); set(hl - 2, ht + 5, H); break;
    case "stringy": hairTop(2, 3); for (const [x, n] of [[0, 6], [1, 4], [3, 3]]) rect(hl + x, ht + 2, 1, n, x === 1 ? H : h); break;
    case "mane": hairTop(2, 4); rect(hl - 1, ht + 1, 3, R.hh + 1, h); rect(hl - 1, ht + R.hh, 1, 3, H); set(hl + 1, ht + R.hh + 2, "#e6c36a"); break;
    case "mohawk": [[0, 1], [-1, 3], [-2, 3], [-3, 3], [-4, 2], [-5, 1]].forEach(([dy, n], i) => { for (let j = 0; j < n; j++) set(CX - 1 + j + (i > 3 ? 1 : 0), ht + dy, j === 0 ? HL : h); });
      rect(hl - 1, ht + 1, 2, 4, h); set(hl - 2, ht + 4, H); break;
  }
  // 뿔 (타우렌)
  if (R.horns) {
    [[hr - 1, ht], [hr, ht - 1], [hr + 1, ht - 2], [hr + 1, ht - 3]].forEach(([x, y], i) => set(x, y, i === 3 ? "#ffffff" : "#efe3c8"));
    [[hl + 1, ht], [hl, ht - 1], [hl - 1, ht - 2], [hl - 1, ht - 3]].forEach(([x, y]) => set(x, y, "#c9bb9c"));
  }
  // 눈
  const ec = R.eye || "#1a1010";
  const eye = (x) => {
    if (sit) { rect(x, eyeY + 1, 2, 1, "#3a2420"); return; }
    rect(x, eyeY, 2, 2, ec);
    if (!R.eye) set(x, eyeY, "#ffffff");
  };
  eye(hr - 3); eye(hr - 6);
  if (R.brow) rect(hr - 6, eyeY - 1, 6, 1, SS);
  // 코·주둥이
  if (R.nose) { set(hr + 1, eyeY + 1, s); set(hr + 1, eyeY + 2, S); if (R.nose > 1) set(hr + 2, eyeY + 2, S); }
  if (R.snout) { rect(hr - 2, eyeY + 2, 4, 3, "#c49a6c"); set(hr + 1, eyeY + 2, "#a57a4e"); set(hr, eyeY + 3, "#3a2414"); set(hr - 1, eyeY + 5, "#e6c36a"); set(hr, eyeY + 5, "#e6c36a"); }
  // 입·엄니·턱
  if (!R.snout && !R.beard) set(hr - 3, ht + R.hh - 2, shade(s, 0.5));
  if (R.tusks) { set(hr - 1, ht + R.hh - 2, "#f4f0e0"); set(hr - 1, ht + R.hh - 1, "#f4f0e0"); set(hr - 5, ht + R.hh - 2, "#e0dccc"); if (R.tusks > 1) set(hr, ht + R.hh - 3, "#f4f0e0"); }
  if (R.jaw) { rect(hr - 5, ht + R.hh - 2, 4, 1, "#e8e4d8"); set(hr - 4, ht + R.hh - 2, "#6a6a5a"); set(hr - 2, ht + R.hh - 2, "#6a6a5a"); set(hl + 2, eyeY - 2, "#6f7f6c"); }
  if (R.beard) {
    rect(hl + 3, eyeY + 2, R.hw - 3, 2, h); rect(hl + 3, ht + R.hh - 1, R.hw - 3, 3, h);
    rect(hl + 4, ht + R.hh + 2, R.hw - 5, 1, H); set(hl + 6, ht + R.hh + 3, H); set(hr - 3, eyeY + 2, shade(s, 0.5));
  }
  if (kind === "rogue" && !R.beard && !R.snout) rect(hl + 3, ht + R.hh - 3, R.hw - 3, 2, "#2b2b33");
  if (drunk && !sit) { set(hr, eyeY + 2, "#e46a6a"); set(hr - 7, eyeY + 2, "#e46a6a"); }

  return toCanvas(G);
}

// 포에버봇: LED 얼굴 로봇 머리를 한 요정 (날개는 따로)
export function buildFairy(blink, glow) {
  const G = grid(16, 18), { set, rect } = G;
  const m = "#cdd6df", mS = "#9aa7b4", mL = "#eef3f7";
  // 머리
  for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) {
    if ((y === 0 || y === 6) && (x === 0 || x === 8)) continue;
    set(3 + x, 3 + y, x >= 7 || y === 6 ? mS : y === 0 || x === 0 ? mL : m);
  }
  rect(4, 5, 7, 3, "#1d2833");
  if (blink) { rect(5, 6, 2, 1, "#4fe0ff"); rect(8, 6, 2, 1, "#4fe0ff"); }
  else { rect(5, 5, 2, 2, "#4fe0ff"); rect(8, 5, 2, 2, "#4fe0ff"); set(5, 5, "#c8f6ff"); set(8, 5, "#c8f6ff"); }
  set(2, 6, "#e6c36a"); set(12, 6, "#e6c36a");
  set(7, 2, mS); set(7, 1, mS); set(7, 0, glow ? "#ffd84a" : "#fff3b0");
  // 몸 (드레스)
  [[6, 3], [5, 5], [4, 7], [4, 7]].forEach(([x, n], i) => { for (let j = 0; j < n; j++) set(x + j, 10 + i, j >= n - 2 ? "#c99b3a" : "#e6c36a"); });
  set(7, 10, "#fff3b0");
  set(4, 11, m); set(10, 11, m);
  set(6, 14, m); set(8, 14, m); set(6, 15, mS); set(8, 15, mS);
  return toCanvas(G);
}
