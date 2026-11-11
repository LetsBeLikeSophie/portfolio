# 와우 포에버 직업·특성 정리 페이지 만들기 (구글 노출용 정적 페이지)
# 블리자드 공식 포에버 데이터(우리 DB에 받아 둔 것)를 공개 읽기 함수로 가져와서
# forever/classes/index.html, forever/classes/<직업>.html, forever/sitemap.xml 을 만든다.
# 사용: python -X utf8 forever/gen_classes.py   (패치로 특성이 바뀌면 sync_classes 뒤에 다시 실행)
import html, json, os, re, urllib.request, datetime

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = "https://itssophie.dev"
idx = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
KEY = re.search(r'SUPABASE_KEY\s*=\s*"([^"]+)"', idx).group(1)
API = "https://ztxzqvnybiemgbhtrwiw.supabase.co/rest/v1/rpc/"

def rpc(name, body):
    req = urllib.request.Request(API + name, data=json.dumps(body).encode(),
        headers={"apikey": KEY, "Authorization": "Bearer " + KEY, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=40))

SLUG = {"전사": "warrior", "성기사": "paladin", "사냥꾼": "hunter", "도적": "rogue", "사제": "priest",
        "주술사": "shaman", "마법사": "mage", "흑마법사": "warlock", "드루이드": "druid"}
COLOR = {"전사": "#C69B6D", "성기사": "#F48CBA", "사냥꾼": "#AAD372", "도적": "#FFF468", "사제": "#FFFFFF",
         "주술사": "#0070DD", "마법사": "#3FC7EB", "흑마법사": "#8788EE", "드루이드": "#FF7C0A"}
ROLE = {"전사": "탱커·근접 딜러", "성기사": "힐러·탱커·근접 딜러", "사냥꾼": "원거리 딜러", "도적": "근접 딜러",
        "사제": "힐러·원거리 딜러", "주술사": "힐러·근접/원거리 딜러", "마법사": "원거리 딜러",
        "흑마법사": "원거리 딜러", "드루이드": "힐러·탱커·딜러"}
ICON = lambda n: f"https://render.worldofwarcraft.com/us/icons/56/{n}.jpg"
CLASS_ICON = {c: f"classicon_{s}" for c, s in SLUG.items()}
RACE_ICON = {"인간": "achievement_character_human_male", "드워프": "achievement_character_dwarf_male",
             "노움": "achievement_character_gnome_male", "나이트 엘프": "achievement_character_nightelf_male",
             "오크": "achievement_character_orc_male", "언데드": "achievement_character_undead_male",
             "타우렌": "achievement_character_tauren_male", "트롤": "achievement_character_troll_male"}
TODAY = datetime.date.today().isoformat()
E = html.escape

# ---------- 데이터 ----------
info = rpc("wow_class_info", {})
classes = info["classes"]
races = info["races"]
data = {}
for c in classes:
    name = c["class"]
    ci = rpc("wow_class_info", {"p_class": name})
    tl = []
    for sp in c["specs"]:
        part = [t for t in rpc("wow_talent_find", {"p_class": name, "p_spec": sp, "p_limit": 60}) if t["spec"] == sp]
        assert len(part) < 60, f"{name} {sp}: 특성이 60개 이상이라 일부가 빠졌을 수 있어요"
        tl += part
    icons = {}
    ids = [t["id"] for t in tl]
    for i in range(0, len(ids), 50):
        for t in rpc("wow_talent_info", {"p_ids": ids[i:i + 50]}):
            icons[t["id"]] = t
    data[name] = {"specs": c["specs"], "power": ci.get("power"), "races": ci.get("races_by_faction") or {}, "talents": tl, "icons": icons}

# ---------- 공통 틀 ----------
CSS = """
:root{--bg:#0d0b09;--card:#17120d;--line:#3a2e1f;--gold:#e6c36a;--gold-dim:#a8873e;--text:#e9e1d2;--muted:#a3977f}
*{box-sizing:border-box}
body{margin:0;background:radial-gradient(1200px 600px at 50% -200px,#2a1f12,transparent),var(--bg);color:var(--text);
  font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif;line-height:1.6;-webkit-text-size-adjust:100%}
a{color:var(--gold)}
.wrap{max-width:860px;margin:0 auto;padding:20px 16px 60px}
.crumb{font-size:13px;color:var(--muted)} .crumb a{color:var(--muted)}
h1{font-family:Georgia,"Times New Roman",serif;color:var(--gold);font-size:28px;margin:10px 0 6px;display:flex;align-items:center;gap:10px}
h1 img{width:40px;height:40px;border-radius:8px;box-shadow:0 0 0 1px #000a}
h2{font-size:20px;margin:34px 0 10px;color:#f3e8d2;border-bottom:1px solid var(--line);padding-bottom:6px}
.lead{color:#d6cab4;margin:4px 0 18px}
.facts{display:grid;grid-template-columns:72px 1fr;gap:6px 12px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:14.5px}
.facts dt{color:var(--muted)} .facts dd{margin:0}
.cta{display:block;margin:18px 0;padding:14px 16px;border-radius:12px;border:1px solid var(--gold-dim);background:#e6c36a14;color:var(--gold);
  text-decoration:none;font-weight:700;text-align:center}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.cls{display:flex;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;text-decoration:none;color:var(--text)}
.cls img{width:44px;height:44px;border-radius:8px} .cls b{display:block;font-size:16px} .cls small{color:var(--muted)}
.row{margin:14px 0 4px;font-size:13px;color:var(--gold-dim);font-weight:700}
.facts dd .fl{display:block}
.tabs{position:sticky;top:0;z-index:5;display:flex;gap:6px;margin:26px -16px 0;padding:10px 16px;background:#0d0b09ee;backdrop-filter:blur(6px);border-bottom:1px solid var(--line)}
.tabs a{flex:1;text-align:center;padding:8px 6px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--muted);text-decoration:none;font-weight:700;font-size:14px}
.tabs a.on{color:#1a1208;background:var(--gold);border-color:var(--gold)}
.spec{scroll-margin-top:70px}
.spec h2{display:flex;align-items:baseline;gap:8px} .spec h2 small{font-size:13px;color:var(--muted);font-weight:500}
.hint{font-size:13px;color:var(--muted);margin:12px 0 0}
.tree{display:grid;gap:12px 6px;background:linear-gradient(#1a140e,#120e0a);border:1px solid var(--line);border-radius:14px;padding:16px 8px 14px 30px}
.tree .rn{font-size:11px;color:var(--gold-dim);align-self:start;justify-self:start;margin:16px 0 0 -24px;width:18px;text-align:center}
.tb{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;min-width:0;-webkit-tap-highlight-color:transparent}
.tb .ic{position:relative;width:48px;height:48px}
.tb img{width:48px;height:48px;border-radius:9px;box-shadow:0 0 0 2px #5a4a2e,0 2px 6px #000c;background:#000;display:block}
.tb .mr{position:absolute;right:-6px;bottom:-5px;font-size:10px;font-weight:800;color:#9fe870;background:#0b0906;border:1px solid #5a4a2e;border-radius:6px;padding:0 4px;line-height:15px}
.tb .nm{font-size:11.5px;line-height:1.25;color:#e9e1d2;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.tb:hover img,.tb:focus-visible img{box-shadow:0 0 0 2px var(--gold),0 2px 8px #000c}
.tb .d{display:none}
dialog{border:1px solid var(--gold-dim);border-radius:16px;background:#17120d;color:var(--text);padding:0;width:min(420px,calc(100% - 32px));box-shadow:0 20px 60px #000}
dialog::backdrop{background:#000a}
.md{padding:18px 18px 16px}
.md .hd{display:flex;gap:12px;align-items:center;margin-bottom:12px}
.md .hd img{width:52px;height:52px;border-radius:10px;box-shadow:0 0 0 2px #5a4a2e}
.md .hd b{display:block;font-size:18px;color:#8fd3ff} .md .hd small{color:var(--muted);font-size:13px}
.md ol{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.md li{font-size:14.5px;background:#ffffff08;border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.md li b{color:var(--gold);font-size:12px;margin-right:6px}
.md li.more{cursor:pointer;text-align:center;color:var(--gold);font-size:13px;font-weight:700;background:none;border-style:dashed;padding:6px}
.md .x{all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:block;text-align:center;margin-top:14px;padding:10px;border-radius:10px;background:#ffffff10;font-weight:700}
.fac{font-size:15px;margin:16px 0 8px;font-weight:700}
.races{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.race{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
.race h3{margin:0 0 8px;font-size:16px;display:flex;align-items:center;gap:8px}
.race h3 img{width:28px;height:28px;border-radius:6px;box-shadow:0 0 0 1px #000a}
.race h3 small{margin-left:auto;font-size:12px;font-weight:500;color:var(--muted)}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{display:inline-flex;align-items:center;gap:5px;font-size:13px;padding:3px 9px 3px 4px;border-radius:999px;background:#ffffff0d;border:1px solid var(--line);text-decoration:none;font-weight:600}
.chip img{width:18px;height:18px;border-radius:50%}
.ally{color:#8fb6ff} .horde{color:#ff8a7a}
.others{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px} .others a{font-size:13px;padding:4px 10px;border:1px solid var(--line);border-radius:999px;text-decoration:none}
footer{margin-top:40px;font-size:12px;color:var(--muted);border-top:1px solid var(--line);padding-top:14px}
"""

def page(title, desc, path, body, ld):
    url = SITE + path
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)}</title>
<meta name="description" content="{E(desc)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="포에버 채팅">
<meta property="og:locale" content="ko_KR">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{E(title)}">
<meta property="og:description" content="{E(desc)}">
<meta property="og:image" content="{SITE}/forever/og.png">
<meta name="theme-color" content="#0d0b09">
<link rel="icon" type="image/png" sizes="192x192" href="/forever/icon-192.png?v=2">
<link rel="apple-touch-icon" href="/forever/apple-touch-icon.png?v=2">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>{CSS}</style>
</head>
<body><div class="wrap">
{body}
<footer>
  블리자드 공식 「월드 오브 워크래프트: 포에버」 게임 데이터 기준 · {TODAY} 업데이트<br>
  비공식 팬 사이트예요. World of Warcraft와 게임 이미지는 Blizzard Entertainment의 자산이며, 이 사이트는 블리자드와 관계없어요.
</footer>
</div></body></html>
"""

def faction_class(f):
    return "ally" if "얼라" in f else "horde"

def tal_btn(d, t, pos):
    ic = d["icons"].get(t["id"], {}).get("icon")
    src = ICON(ic) if ic else ""
    descs = t.get("descs") or []
    lis = "".join(f'<li><b>{i}등급</b>{E(x)}</li>' for i, x in enumerate(descs, 1))
    return (f'<button class="tb" type="button" style="{pos}"><span class="ic"><img src="{src}" alt="{E(t["name"])} 아이콘" loading="lazy" width="48" height="48">'
            f'<span class="mr">{t["max_rank"]}</span></span><span class="nm">{E(t["name"])}</span>'
            f'<span class="d" data-max="{t["max_rank"]}"><ol>{lis}</ol></span></button>')

TREE_JS = """
const md=document.getElementById('md');
document.querySelectorAll('.tb').forEach(b=>b.addEventListener('click',()=>{
  const d=b.querySelector('.d');
  document.getElementById('mdI').src=b.querySelector('img').src;
  document.getElementById('mdN').textContent=b.querySelector('.nm').textContent;
  document.getElementById('mdR').textContent=b.closest('.spec').querySelector('h2').firstChild.textContent.trim()+' · 최대 '+d.dataset.max+'등급';
  const L=document.getElementById('mdL');L.innerHTML=d.querySelector('ol').innerHTML;
  const li=[...L.children];
  if(li.length>2){const mid=li.slice(1,-1);mid.forEach(x=>x.hidden=true);
    const m=document.createElement('li');m.className='more';m.textContent=(li.length>3?'2~'+(li.length-1):'2')+'등급도 보기';
    m.onclick=()=>{mid.forEach(x=>x.hidden=false);m.remove()};li[0].after(m);}
  md.showModal();
}));
document.getElementById('mdX').onclick=()=>md.close();
md.addEventListener('click',e=>{if(e.target===md)md.close()});
const tabs=[...document.querySelectorAll('.tabs a')],secs=tabs.map(a=>document.getElementById(decodeURIComponent(a.hash.slice(1))));
function onScroll(){let k=0;secs.forEach((s,i)=>{if(s.getBoundingClientRect().top<120)k=i});tabs.forEach((a,i)=>a.classList.toggle('on',i===k))}
addEventListener('scroll',onScroll,{passive:true});onScroll();
"""

# ---------- 직업 페이지 ----------
urls = []
for name, d in data.items():
    slug = SLUG[name]; path = f"/forever/classes/{slug}.html"; urls.append(path)
    specs = d["specs"]
    race_txt = "".join(f'<span class="fl"><span class="{faction_class(f)}">{E(f)}</span> · {E(", ".join(rs))}</span>' for f, rs in d["races"].items())
    sec = []
    for sp in specs:
        tl = [t for t in d["talents"] if t["spec"] == sp]
        ok = [t for t in tl if t["row"] is not None and t["row"] <= 10 and t.get("col")]
        base = min([t["col"] for t in ok] or [1]) - 1   # 직업 전체 칸 번호라 전문화마다 1부터 다시 셈
        ncol = 4
        main = [t for t in ok if 1 <= t["col"] - base <= ncol]
        for t in main: t["c"] = t["col"] - base
        extra = [t for t in tl if t not in main]
        rows = sorted({t["row"] for t in main})
        cells = []
        for gi, r in enumerate(rows, 1):
            cells.append(f'<span class="rn" style="grid-row:{gi};grid-column:1">{r}</span>')
            for t in sorted([t for t in main if t["row"] == r], key=lambda x: x["c"]):
                cells.append(tal_btn(d, t, f"grid-row:{gi};grid-column:{t['c']}"))
        gi = len(rows)
        for i, t in enumerate(extra):
            if i % ncol == 0: gi += 1
            cells.append(tal_btn(d, t, f"grid-row:{gi};grid-column:{i % ncol + 1}"))
        sec.append(f'<section class="spec" id="{E(sp)}"><h2>{E(name)} {E(sp)} 특성 <small>{len(tl)}개</small></h2>'
                   f'<div class="tree" style="grid-template-columns:repeat({ncol},minmax(0,1fr))">{"".join(cells)}</div></section>')
    others = "".join(f'<a href="/forever/classes/{SLUG[o]}.html">{E(o)}</a>' for o in data if o != name)
    body = f"""
<div class="crumb"><a href="/forever/">포에버 채팅</a> › <a href="/forever/classes/">직업 정리</a> › {E(name)}</div>
<h1><img src="{ICON(CLASS_ICON[name])}" alt="{E(name)} 아이콘" width="40" height="40"><span style="color:{COLOR[name]}">{E(name)}</span></h1>
<p class="lead">와우 포에버 {E(name)}의 전문화 {len(specs)}개({E(", ".join(specs))})와 특성 {len(d["talents"])}개를 블리자드 공식 데이터 그대로 정리했어요. 수치는 포에버 기준이에요.</p>
<dl class="facts">
  <dt>역할</dt><dd>{E(ROLE[name])}</dd>
  <dt>자원</dt><dd>{E(d["power"] or "-")}</dd>
  <dt>전문화</dt><dd>{" · ".join(f'<a href="#{E(s)}">{E(s)}</a>' for s in specs)}</dd>
  <dt>종족</dt><dd>{race_txt}</dd>
</dl>
<a class="cta" href="/forever/">🤖 {E(name)} 특성, 포에버봇에게 물어보기</a>
<nav class="tabs">{"".join(f'<a href="#{E(s)}">{E(s)}</a>' for s in specs)}</nav>
<p class="hint">특성 아이콘을 누르면 등급별 설명이 나와요. 왼쪽 숫자는 위에서부터 몇 번째 줄인지예요.</p>
{"".join(sec)}
<dialog id="md"><div class="md"><div class="hd"><img id="mdI" alt=""><div><b id="mdN"></b><small id="mdR"></small></div></div><ol id="mdL"></ol><button class="x" id="mdX" type="button">닫기</button></div></dialog>
<script>{TREE_JS}</script>
<h2>다른 직업</h2><div class="others">{others}</div>
<a class="cta" href="/forever/">와우 포에버 채팅에서 파티·길드 구하고 포에버봇에게 물어보기</a>
"""
    title = f"와우 포에버 {name} 특성·전문화 정리 ({', '.join(specs)}) | 포에버 채팅"
    desc = f"와우 포에버 {name} 전문화 {', '.join(specs)}와 특성 {len(d['talents'])}개를 블리자드 공식 데이터 기준 수치로 정리했어요. 고를 수 있는 종족, 자원, 역할까지."
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": title, "inLanguage": "ko",
          "dateModified": TODAY, "url": SITE + path, "about": f"와우 포에버 {name}",
          "publisher": {"@type": "Organization", "name": "포에버 채팅"}}
    os.makedirs(os.path.join(ROOT, "classes"), exist_ok=True)
    open(os.path.join(ROOT, "classes", f"{slug}.html"), "w", encoding="utf-8", newline="\n").write(page(title, desc, path, body, ld))

# ---------- 전체 직업 페이지 ----------
cards = "".join(f'<a class="cls" href="/forever/classes/{SLUG[n]}.html"><img src="{ICON(CLASS_ICON[n])}" alt="{E(n)} 아이콘" width="44" height="44">'
                f'<span><b style="color:{COLOR[n]}">{E(n)}</b><small>{E(ROLE[n])} · {E(" / ".join(d["specs"]))}</small></span></a>' for n, d in data.items())
class_names = list(data.keys())
def race_card(r):
    ic = RACE_ICON.get(r["race"])
    img = f'<img src="{ICON(ic)}" alt="{E(r["race"])} 아이콘" loading="lazy" width="28" height="28">' if ic else ""
    chips = "".join(f'<a class="chip" href="/forever/classes/{SLUG[n]}.html" style="color:{COLOR[n]}">'
                    f'<img src="{ICON(CLASS_ICON[n])}" alt="" loading="lazy" width="18" height="18">{E(n)}</a>'
                    for n in class_names if n in r["classes"])
    return (f'<div class="race"><h3>{img}<span class="{faction_class(r["faction"])}">{E(r["race"])}</span>'
            f'<small>직업 {sum(n in r["classes"] for n in class_names)}개</small></h3><div class="chips">{chips}</div></div>')
factions = []
for r in races:
    if r["faction"] not in factions: factions.append(r["faction"])
race_html = "".join(f'<div class="fac {faction_class(f)}">{E(f)}</div><div class="races">'
                    + "".join(race_card(r) for r in races if r["faction"] == f) + "</div>" for f in factions)
body = f"""
<div class="crumb"><a href="/forever/">포에버 채팅</a> › 직업 정리</div>
<h1>와우 포에버 직업 정리</h1>
<p class="lead">와우 포에버(월드 오브 워크래프트: 포에버)의 직업 9개, 전문화 27개, 특성 470개를 블리자드 공식 게임 데이터 기준으로 정리했어요. 직업을 누르면 전문화별 특성과 등급별 수치를 볼 수 있어요.</p>
<div class="grid">{cards}</div>
<a class="cta" href="/forever/">🤖 포에버봇에게 물어보러 가기</a>
<h2>종족별로 고를 수 있는 직업</h2>
{race_html}
<p class="lead" style="margin-top:10px">포에버에는 얼라이언스 「고등 마법원 스카이본」과 호드 「바람구체자 스카이본」 종족이 새로 있어요.</p>
"""
title = "와우 포에버 직업 정리 – 9개 직업·전문화·특성, 종족별 직업 | 포에버 채팅"
desc = "와우 포에버 직업 9개(전사, 성기사, 사냥꾼, 도적, 사제, 주술사, 마법사, 흑마법사, 드루이드)의 전문화와 특성 470개, 종족별로 고를 수 있는 직업을 블리자드 공식 데이터로 정리했어요."
ld = {"@context": "https://schema.org", "@type": "ItemList", "name": title, "inLanguage": "ko",
      "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "url": f"{SITE}/forever/classes/{SLUG[n]}.html"} for i, n in enumerate(class_names)]}
open(os.path.join(ROOT, "classes", "index.html"), "w", encoding="utf-8", newline="\n").write(page(title, desc, "/forever/classes/", body, ld))

# ---------- 사이트맵 ----------
all_urls = ["/forever/", "/forever/classes/"] + urls
sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
    f"  <url><loc>{SITE}{u}</loc><lastmod>{TODAY}</lastmod></url>\n" for u in all_urls) + "</urlset>\n"
open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8", newline="\n").write(sm)
print("ok", len(all_urls), "pages;", sum(len(d["talents"]) for d in data.values()), "talents")
