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
.cta{display:flex;align-items:center;justify-content:center;gap:10px;margin:18px 0;padding:12px 16px;border-radius:12px;border:1px solid var(--gold-dim);background:#e6c36a14;color:var(--gold);
  text-decoration:none;font-weight:700;text-align:center}
.boti{flex:none;display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#e6c36a24;box-shadow:0 0 0 1.5px var(--gold-dim);color:var(--gold)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
.cls{display:flex;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;text-decoration:none;color:var(--text)}
.cls img{width:44px;height:44px;border-radius:8px} .cls b{display:block;font-size:16px} .cls small{color:var(--muted)}
.row{margin:14px 0 4px;font-size:13px;color:var(--gold-dim);font-weight:700}
.facts dd .fl{display:block}
.tabs{display:flex;gap:4px;margin:28px 0 0;padding:4px;background:#ffffff0a;border:1px solid var(--line);border-radius:12px}
.tabs a{flex:1;text-align:center;padding:7px 4px;border-radius:9px;color:var(--muted);text-decoration:none;font-weight:700;font-size:14px;transition:background .15s,color .15s}
.tabs a small{font-weight:500;font-size:11px;opacity:.75;margin-left:3px}
.tabs a.on{color:#1a1208;background:var(--gold)}
.specs{margin-top:10px;touch-action:pan-y}
.js .spec h2{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.js .spec{animation:specIn .22s ease}
.js .spec.fromL{animation-name:specInL}
@keyframes specIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:none}}
@keyframes specInL{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
.spec h2{display:flex;align-items:baseline;gap:8px} .spec h2 small{font-size:13px;color:var(--muted);font-weight:500}
.calc{display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:13px;color:var(--muted)}
.calc b{color:var(--gold);font-size:16px;margin:0 2px}
.calc .sp{flex:1}
.calc button{all:unset;cursor:pointer;padding:5px 10px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--text);font-size:12.5px;font-weight:700}
.calc button:disabled{opacity:.35;cursor:default}
.tb .mr{min-width:10px;text-align:center}
.tb.lock img{filter:grayscale(1) brightness(.45)}
.tb.lock .nm{color:#7d7262}
.tb.has img{box-shadow:0 0 0 2px #6fd04a,0 2px 6px #000c}
.tb.full img{box-shadow:0 0 0 2px var(--gold),0 0 10px #e6c36a66}
.tb.full .mr{color:var(--gold);border-color:var(--gold-dim)}
.tb.lock .mr{color:#7d7262}
.tree .rn.need{color:#5d5040}
.ctl{display:flex;align-items:center;gap:10px;margin:0 0 12px}
.ctl button{all:unset;cursor:pointer;width:46px;height:40px;border-radius:10px;text-align:center;font:800 22px/40px sans-serif;background:#ffffff10;border:1px solid var(--line);color:var(--text)}
.ctl button.plus{background:#e6c36a;color:#1a1208;border-color:#e6c36a}
.ctl button:disabled{opacity:.3;cursor:default}
.ctl .rk{flex:1;text-align:center;font-size:15px;font-weight:700} .ctl .rk small{display:block;font-size:12px;color:var(--muted);font-weight:500}
.md li.cur{border-color:#6fd04a;background:#6fd04a14}
.md li.nx{border-style:dashed}
.md li i{font-style:normal;font-size:11px;color:var(--muted);margin-left:6px}
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
.flt{display:flex;flex-direction:column;gap:8px;margin:14px 0 12px;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:14px}
.fr{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.fr>span{flex:none;width:34px;font-size:12px;color:var(--muted);font-weight:700}
.fb{all:unset;cursor:pointer;padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:#ffffff08;font-size:13.5px;font-weight:700;color:var(--muted);-webkit-tap-highlight-color:transparent}
.fb[aria-pressed="true"]{background:var(--gold);border-color:var(--gold);color:#1a1208}
.fr select{flex:1;min-width:0;max-width:260px;padding:6px 8px;border-radius:10px;border:1px solid var(--line);background:#0d0b09;color:var(--text);font:inherit;font-size:14px}
.fr .clr{all:unset;cursor:pointer;margin-left:auto;font-size:12.5px;color:var(--gold-dim);text-decoration:underline}
.cnt{font-size:12.5px;color:var(--muted);margin:0 0 8px}
.cg{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
@media (min-width:560px){.cg{grid-template-columns:repeat(9,1fr)}}
.ct{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 4px 10px;background:var(--card);border:1px solid var(--line);border-radius:12px;text-decoration:none;color:var(--text);text-align:center}
.ct:hover,.ct:focus-visible{border-color:var(--gold-dim)}
.ct img{width:46px;height:46px;border-radius:9px;box-shadow:0 0 0 1px #000a}
.ct b{font-size:14px;line-height:1.2;word-break:keep-all}
.ct small{font-size:11px;line-height:1.2;color:var(--muted)}
.ct.off{display:none}
.none{grid-column:1/-1;text-align:center;color:var(--muted);font-size:14px;padding:18px 0}
.rinfo{margin:12px 0 0;padding:12px;background:var(--card);border:1px solid var(--line);border-radius:12px;font-size:14px}
.rinfo b{font-size:16px} .rinfo p{margin:6px 0 0;color:var(--muted);font-size:13px}
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
</div>
<script>
// 몇 명이 정리 페이지를 봤는지 숫자만 셈 (이름·기기 정보 없이 기기마다 하루 한 번)
function track(step){{try{{const k='wowchat_tr_'+step,d=new Date().toLocaleDateString('sv');if(localStorage.getItem(k)===d)return;localStorage.setItem(k,d)}}catch(_){{}}
  fetch('{API}wow_track',{{method:'POST',headers:{{apikey:'{KEY}',Authorization:'Bearer {KEY}','Content-Type':'application/json'}},body:JSON.stringify({{p_step:step}}),keepalive:true}}).catch(()=>{{}})}}
track('guide_view');
</script>
</body></html>
"""

def faction_class(f):
    return "ally" if "얼라" in f else "horde"

def tal_btn(d, t, pos, req_row):
    ic = d["icons"].get(t["id"], {}).get("icon")
    src = ICON(ic) if ic else ""
    descs = t.get("descs") or []
    lis = "".join(f'<li><b>{i}등급</b>{E(x)}</li>' for i, x in enumerate(descs, 1))
    return (f'<button class="tb" type="button" style="{pos}" data-row="{req_row}" data-max="{t["max_rank"]}"><span class="ic"><img src="{src}" alt="{E(t["name"])} 아이콘" loading="lazy" width="48" height="48">'
            f'<span class="mr">{t["max_rank"]}</span></span><span class="nm">{E(t["name"])}</span>'
            f'<span class="d" data-max="{t["max_rank"]}"><ol>{lis}</ol></span></button>')

BOT_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v3"/><circle cx="12" cy="2.6" r="1" fill="currentColor" stroke="none"/><rect x="4.5" y="6.5" width="15" height="12" rx="3.5"/><circle cx="9.3" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="14.7" cy="12" r="1.6" fill="currentColor" stroke="none"/><path d="M9.5 15.6h5"/><path d="M2.5 11v3M21.5 11v3"/></svg>'

TREE_JS = """
document.documentElement.classList.add('js');
const $=id=>document.getElementById(id), md=$('md'), TOTAL=51;
const tabs=[...document.querySelectorAll('.tabs a')],secs=tabs.map(a=>$(decodeURIComponent(a.hash.slice(1))));
const trees=secs.map(s=>[...s.querySelectorAll('.tb')]);
const rk=trees.map(t=>t.map(()=>0));
// 특성 계산기: 60레벨 51포인트, 아래 줄은 그 트리에 (줄-1)×5포인트를 써야 열려요
const spent=i=>rk[i].reduce((a,b)=>a+b,0), used=()=>rk.reduce((a,_,i)=>a+spent(i),0);
const rowOf=(i,j)=>+trees[i][j].dataset.row, maxOf=(i,j)=>+trees[i][j].dataset.max;
const below=(i,r,arr)=>arr.reduce((a,v,j)=>a+(rowOf(i,j)<r?v:0),0);
const open=(i,j)=>below(i,rowOf(i,j),rk[i])>=(rowOf(i,j)-1)*5;
const canAdd=(i,j)=>rk[i][j]<maxOf(i,j)&&used()<TOTAL&&open(i,j);
function canSub(i,j){if(!rk[i][j])return false;const a=rk[i].slice();a[j]--;
  return a.every((v,k)=>!v||below(i,rowOf(i,k),a)>=(rowOf(i,k)-1)*5);}
function paint(){
  trees.forEach((t,i)=>{t.forEach((b,j)=>{const v=rk[i][j],m=maxOf(i,j);
    b.querySelector('.mr').textContent=v+'/'+m;
    b.classList.toggle('has',v>0&&v<m);b.classList.toggle('full',v===m);b.classList.toggle('lock',!v&&!open(i,j));});
    secs[i].querySelectorAll('.rn').forEach(n=>n.classList.toggle('need',below(i,+n.dataset.row,rk[i])<(+n.dataset.row-1)*5));
    tabs[i].querySelector('small').textContent=spent(i);});
  $('left').textContent=TOTAL-used();$('reset').disabled=!used();
  const code=rk.map(a=>a.join('').replace(/0+$/,'')).join('-');
  const u=new URL(location.href);if(used())u.searchParams.set('b',code);else u.searchParams.delete('b');
  history.replaceState(history.state,'',u);
}
function load(){const c=new URL(location.href).searchParams.get('b');if(!c)return;
  c.split('-').forEach((p,i)=>{if(!rk[i])return;[...p].forEach((ch,j)=>{if(j<rk[i].length)rk[i][j]=Math.min(+ch||0,maxOf(i,j))})});
  rk.forEach((a,i)=>{if(!a.every((v,k)=>!v||below(i,rowOf(i,k),a)>=(rowOf(i,k)-1)*5))a.fill(0)});
  if(used()>TOTAL)rk.forEach(a=>a.fill(0));}
let mi=-1,mj=-1;
function fillMd(){const b=trees[mi][mj],d=b.querySelector('.d'),v=rk[mi][mj],m=maxOf(mi,mj);
  $('mdK').innerHTML=v+' / '+m+'<small>'+(open(mi,mj)?(used()>=TOTAL&&v<m?'포인트를 다 썼어요':'이 트리에 '+spent(mi)+'포인트'):'위 줄에 '+((rowOf(mi,mj)-1)*5)+'포인트를 써야 열려요')+'</small>';
  $('mdP').disabled=!canAdd(mi,mj);$('mdM').disabled=!canSub(mi,mj);
  const L=$('mdL');L.innerHTML=d.querySelector('ol').innerHTML;const li=[...L.children];
  const show=new Set([Math.max(v,1)-1]);if(v&&v<m)show.add(v);
  li.forEach((x,k)=>{x.classList.toggle('cur',k===v-1);x.classList.toggle('nx',k===v&&v<m);
    if(k===v&&v>0&&v<m)x.insertAdjacentHTML('beforeend','<i>다음 등급</i>');x.hidden=!show.has(k)});
  if(li.length>show.size){const mo=document.createElement('li');mo.className='more';mo.textContent='모든 등급 보기';
    mo.onclick=()=>{li.forEach(x=>x.hidden=false);mo.remove()};L.appendChild(mo);}}
trees.forEach((t,i)=>t.forEach((b,j)=>b.addEventListener('click',()=>{mi=i;mj=j;
  $('mdI').src=b.querySelector('img').src;$('mdN').textContent=b.querySelector('.nm').textContent;
  $('mdR').textContent=secs[i].querySelector('h2').firstChild.textContent.trim();fillMd();md.showModal();})));
$('mdP').onclick=()=>{if(canAdd(mi,mj)){rk[mi][mj]++;paint();fillMd();track('calc_use');}};
$('mdM').onclick=()=>{if(canSub(mi,mj)){rk[mi][mj]--;paint();fillMd();}};
$('mdX').onclick=()=>md.close();
md.addEventListener('click',e=>{if(e.target===md)md.close()});
$('reset').onclick=()=>{if(confirm('찍은 특성을 모두 지울까요?')){rk.forEach(a=>a.fill(0));paint();}};
$('share').onclick=async()=>{const u=location.href;try{if(navigator.share){await navigator.share({title:document.title,url:u});return}
  await navigator.clipboard.writeText(u);$('share').textContent='복사했어요';setTimeout(()=>$('share').textContent='링크 복사',1500)}catch(_){}};
let cur=-1;
function show(i){i=(i+secs.length)%secs.length;if(i===cur)return;const back=cur>=0&&i<cur;
  secs.forEach((s,k)=>{s.hidden=k!==i;s.classList.toggle('fromL',back)});tabs.forEach((a,k)=>a.classList.toggle('on',k===i));
  cur=i;const u=new URL(location.href);u.hash=tabs[i].hash;history.replaceState(history.state,'',u);}
const idx=h=>secs.findIndex(s=>'#'+s.id===decodeURIComponent(h));
tabs.forEach((a,i)=>a.addEventListener('click',e=>{e.preventDefault();show(i)}));
document.querySelectorAll('.facts a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const i=idx(a.hash);if(i<0)return;e.preventDefault();show(i);document.querySelector('.tabs').scrollIntoView({behavior:'smooth',block:'start'})}));
load();show(Math.max(0,idx(location.hash)));paint();
// 트리 위에서 옆으로 밀면 전문화가 바뀌어요 (화면 맨 가장자리는 뒤로가기용이라 빼요)
let sx=null,sy=0;const area=document.querySelector('.specs');
area.addEventListener('touchstart',e=>{const t=e.touches[0];sx=(e.touches.length===1&&t.clientX>30&&t.clientX<innerWidth-30)?t.clientX:null;sy=t.clientY},{passive:true});
area.addEventListener('touchend',e=>{if(sx===null)return;const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;sx=null;
  if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.5)show(cur+(dx<0?1:-1))},{passive:true});
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
            cells.append(f'<span class="rn" data-row="{r}" style="grid-row:{gi};grid-column:1">{r}</span>')
            for t in sorted([t for t in main if t["row"] == r], key=lambda x: x["c"]):
                cells.append(tal_btn(d, t, f"grid-row:{gi};grid-column:{t['c']}", r))
        gi = len(rows)
        for i, t in enumerate(extra):
            if i % ncol == 0: gi += 1
            cells.append(tal_btn(d, t, f"grid-row:{gi};grid-column:{i % ncol + 1}", t["row"] if t["row"] and t["row"] <= 10 else 1))
        sec.append(f'<section class="spec" id="{E(sp)}"><h2>{E(name)} {E(sp)} 특성 <small>{len(tl)}개</small></h2>'
                   f'<div class="tree" style="grid-template-columns:repeat({ncol},minmax(0,1fr))">{"".join(cells)}</div></section>')
    others = "".join(f'<a href="/forever/classes/{SLUG[o]}.html">{E(o)}</a>' for o in data if o != name)
    body = f"""
<div class="crumb"><a href="/forever/">포에버 채팅</a> › <a href="/forever/classes/">직업 정리</a> › {E(name)}</div>
<h1><img src="{ICON(CLASS_ICON[name])}" alt="{E(name)} 아이콘" width="40" height="40"><span style="color:{COLOR[name]}">{E(name)}</span></h1>
<dl class="facts">
  <dt>역할</dt><dd>{E(ROLE[name])}</dd>
  <dt>자원</dt><dd>{E(d["power"] or "-")}</dd>
  <dt>전문화</dt><dd>{" · ".join(f'<a href="#{E(s)}">{E(s)}</a>' for s in specs)}</dd>
  <dt>종족</dt><dd>{race_txt}</dd>
</dl>
<a class="cta" href="/forever/"><span class="boti">{BOT_SVG}</span>{E(name)} 특성, 포에버봇에게 물어보기</a>
<nav class="tabs">{"".join(f'<a href="#{E(s)}">{E(s)}<small>{sum(t["spec"] == s for t in d["talents"])}</small></a>' for s in specs)}</nav>
<div class="calc">남은 포인트<b id="left">51</b><span class="sp"></span><button type="button" id="share">링크 복사</button><button type="button" id="reset">초기화</button></div>
<div class="specs">{"".join(sec)}</div>
<dialog id="md"><div class="md"><div class="hd"><img id="mdI" alt=""><div><b id="mdN"></b><small id="mdR"></small></div></div>
<div class="ctl"><button type="button" id="mdM" aria-label="한 등급 빼기">−</button><div class="rk" id="mdK"></div><button type="button" class="plus" id="mdP" aria-label="한 등급 올리기">+</button></div>
<ol id="mdL"></ol><button class="x" id="mdX" type="button">닫기</button></div></dialog>
<script>{TREE_JS}</script>
<script src="/forever/swipe.js" defer></script>
<h2>다른 직업</h2><div class="others">{others}</div>
<a class="cta" href="/forever/"><span class="boti">{BOT_SVG}</span>와우 포에버 채팅에서 파티 구하고 포에버봇에게 물어보기</a>
"""
    title = f"와우 포에버 {name} 특성·전문화 정리 ({', '.join(specs)}) | 포에버 채팅"
    desc = f"와우 포에버 {name} 전문화 {', '.join(specs)}와 특성 {len(d['talents'])}개를 블리자드 공식 데이터 기준 수치로 정리했어요. 고를 수 있는 종족, 자원, 역할까지."
    ld = {"@context": "https://schema.org", "@type": "Article", "headline": title, "inLanguage": "ko",
          "dateModified": TODAY, "url": SITE + path, "about": f"와우 포에버 {name}",
          "publisher": {"@type": "Organization", "name": "포에버 채팅"}}
    os.makedirs(os.path.join(ROOT, "classes"), exist_ok=True)
    open(os.path.join(ROOT, "classes", f"{slug}.html"), "w", encoding="utf-8", newline="\n").write(page(title, desc, path, body, ld))

# ---------- 전체 직업 페이지: 아이콘 격자 + 역할·거리 다중 필터 + 종족 드롭다운 ----------
ROLES = {"전사": ["tank", "dps"], "성기사": ["heal", "tank", "dps"], "사냥꾼": ["dps"], "도적": ["dps"],
         "사제": ["heal", "dps"], "주술사": ["heal", "dps"], "마법사": ["dps"], "흑마법사": ["dps"],
         "드루이드": ["heal", "tank", "dps"]}
RANGE = {"전사": ["melee"], "성기사": ["melee"], "사냥꾼": ["ranged"], "도적": ["melee"], "사제": ["ranged"],
         "주술사": ["melee", "ranged"], "마법사": ["ranged"], "흑마법사": ["ranged"], "드루이드": ["melee", "ranged"]}
SHORT = {"tank": "탱", "dps": "딜", "heal": "힐"}
class_names = list(data.keys())
cards = "".join(
    f'<a class="ct" href="/forever/classes/{SLUG[n]}.html" data-c="{E(n)}" data-role="{" ".join(ROLES[n])}" data-range="{" ".join(RANGE[n])}">'
    f'<img src="{ICON(CLASS_ICON[n])}" alt="" width="46" height="46"><b style="color:{COLOR[n]}">{E(n)}</b>'
    f'<small>{"·".join(SHORT[r] for r in ["tank", "dps", "heal"] if r in ROLES[n])}</small></a>' for n in class_names)
factions = []
for r in races:
    if r["faction"] not in factions: factions.append(r["faction"])
race_opts = "".join(f'<optgroup label="{E(f)}">' + "".join(f'<option value="{E(r["race"])}">{E(r["race"])}</option>'
                    for r in races if r["faction"] == f) + "</optgroup>" for f in factions)
race_js = json.dumps({r["race"]: {"f": r["faction"], "c": [n for n in class_names if n in r["classes"]]} for r in races}, ensure_ascii=False)
FILTER_JS = """
(()=>{const R=__RACES__;const st={role:new Set(),range:new Set(),race:""};
const tiles=[...document.querySelectorAll('.ct')],sel=document.getElementById('race'),cnt=document.getElementById('cnt'),none=document.getElementById('none'),ri=document.getElementById('rinfo');
function apply(){let n=0;tiles.forEach(t=>{const ro=t.dataset.role.split(' '),ra=t.dataset.range.split(' ');
  const ok=(!st.role.size||ro.some(x=>st.role.has(x)))&&(!st.range.size||ra.some(x=>st.range.has(x)))&&(!st.race||R[st.race].c.includes(t.dataset.c));
  t.classList.toggle('off',!ok);if(ok)n++;});
  none.hidden=n>0;const any=st.role.size||st.range.size||st.race;cnt.textContent=any?`직업 9개 중 ${n}개`:'직업 9개';
  document.getElementById('clr').hidden=!any;
  if(st.race){const r=R[st.race];ri.hidden=false;ri.innerHTML='';const b=document.createElement('b');b.textContent=st.race;b.className=r.f.includes('얼라')?'ally':'horde';
    const p=document.createElement('p');p.textContent=`${r.f} · 고를 수 있는 직업 ${r.c.length}개 (${r.c.join(', ')})`;ri.append(b,p);}else ri.hidden=true;
  const q=new URLSearchParams();if(st.role.size)q.set('role',[...st.role].join(','));if(st.range.size)q.set('range',[...st.range].join(','));if(st.race)q.set('race',st.race);
  history.replaceState(null,'',location.pathname+(q.toString()?'?'+q:''));}
document.querySelectorAll('.fb').forEach(b=>{b.onclick=()=>{const g=st[b.dataset.g],v=b.dataset.v;g.has(v)?g.delete(v):g.add(v);b.setAttribute('aria-pressed',g.has(v));apply();};});
sel.onchange=()=>{st.race=sel.value;apply();};
document.getElementById('clr').onclick=()=>{st.role.clear();st.range.clear();st.race='';sel.value='';document.querySelectorAll('.fb').forEach(b=>b.setAttribute('aria-pressed','false'));apply();};
const q=new URLSearchParams(location.search);
for(const g of ['role','range'])(q.get(g)||'').split(',').filter(Boolean).forEach(v=>{const b=document.querySelector(`.fb[data-g="${g}"][data-v="${v}"]`);if(b){st[g].add(v);b.setAttribute('aria-pressed','true');}});
if(R[q.get('race')]){st.race=q.get('race');sel.value=st.race;}
apply();})();
""".replace("__RACES__", race_js)
body = f"""
<div class="crumb"><a href="/forever/">포에버 채팅</a> › 직업 정리</div>
<h1>와우 포에버 직업 정리</h1>
<div class="flt" role="group" aria-label="직업 거르기">
  <div class="fr"><span>역할</span><button type="button" class="fb" data-g="role" data-v="tank" aria-pressed="false">🛡️ 탱커</button><button type="button" class="fb" data-g="role" data-v="dps" aria-pressed="false">⚔️ 딜러</button><button type="button" class="fb" data-g="role" data-v="heal" aria-pressed="false">✚ 힐러</button></div>
  <div class="fr"><span>거리</span><button type="button" class="fb" data-g="range" data-v="melee" aria-pressed="false">근접</button><button type="button" class="fb" data-g="range" data-v="ranged" aria-pressed="false">원거리</button></div>
  <div class="fr"><span>종족</span><select id="race" aria-label="종족"><option value="">모든 종족</option>{race_opts}</select><button type="button" class="clr" id="clr" hidden>모두 풀기</button></div>
</div>
<p class="cnt" id="cnt">직업 9개</p>
<div class="cg">{cards}<p class="none" id="none" hidden>조건에 맞는 직업이 없어요</p></div>
<div class="rinfo" id="rinfo" hidden></div>
<a class="cta" href="/forever/"><span class="boti">{BOT_SVG}</span>포에버봇에게 물어보러 가기</a>
<p class="lead" style="margin-top:10px">역할·거리는 여러 개 고를 수 있어요. 포에버에는 얼라이언스 「고등 마법원 스카이본」과 호드 「바람구체자 스카이본」 종족이 새로 있어요.</p>
<script>{FILTER_JS}</script>
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
