// 와우 포에버 채팅 - 블리자드 API + 포에버봇 서버 함수
//  GET  ?action=login_url&redirect_uri=...&state=...   배틀넷 로그인 주소
//  POST ?action=exchange  {code, redirect_uri}         로그인 코드 → 계정 저장 + 내 포에버 캐릭터 목록
//  GET  ?action=search&q=검색어                        [ 자동완성 (퀘스트·아이템·NPC·주문·업적)
//  GET  ?action=quest&id=번호                          퀘스트 간단 정보 (지역, 조건, 선행 퀘스트, 보상) - 퀘스트 카드용
//  POST ?action=bot  {token, message_id}               @포에버봇 질문에 AI로 답하기
//  POST ?action=bmc&key=...                            Buy Me a Coffee 웹훅 → 포에버봇 배터리 충전 (key는 wow.bot_settings.webhook_key)
//  GET  ?name=이름-성 / ?rulesets=1 / ?realm_id=번호 / ?media=이름-성   진단용
// 비밀값: BLIZZARD_CLIENT_ID, BLIZZARD_CLIENT_SECRET, FOREVER_BOT_PROD_ANTHROPIC_KEY
// 선택: BLIZZARD_REGION(기본 kr), ALLOWED_REDIRECTS(쉼표 구분), FOREVER_BOT_MODEL(기본 claude-haiku-5-5)
// 배포: Supabase 프로젝트 camtrip 의 Edge Function "wow-character" (verify_jwt 끔)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body: unknown, status = 200, cacheable = false) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8",
    ...(cacheable ? { "Cache-Control": "public, max-age=3600" } : {}) } });

const DEFAULT_REDIRECTS = ["https://itssophie.dev/forever/"];
const BOT_NAME = "포에버봇";

let cachedToken: { value: string; exp: number } | null = null;
async function getAppToken(id: string, secret: string): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch("https://oauth.battle.net/token", {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error("블리자드 인증 실패 (" + res.status + ") - Client ID/Secret 값을 확인해 주세요");
  const data = await res.json();
  cachedToken = { value: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

async function api(url: string, token: string) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  let body: any = null;
  try { body = await r.json(); } catch (_) { /* */ }
  return { status: r.status, body };
}

const withTimeout = <T,>(p: Promise<T>, ms = 4000) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

const serviceClient = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// ---------- 게임 데이터 검색 (포에버 한국 공식 데이터) ----------
const searchCache = new Map<string, { exp: number; results: any[] }>();
let achCache: { exp: number; list: { id: number; name: string }[] } | null = null;
async function loadAchievements(host: string, ns: string, token: string) {
  if (achCache && achCache.exp > Date.now()) return achCache.list;
  const r = await api(`${host}/data/wow/achievement/index?namespace=${ns}&locale=ko_KR`, token);
  const list = (r.body?.achievements ?? []).map((a: any) => ({ id: a.id, name: String(a.name ?? "") })).filter((a: any) => a.name);
  achCache = { exp: Date.now() + 24 * 3600_000, list };
  return list;
}

async function searchGame(q: string, host: string, region: string, token: string) {
  q = q.trim().slice(0, 30);
  if (!q) return [];
  const key = region + ":" + q;
  const hit = searchCache.get(key);
  if (hit && hit.exp > Date.now()) return hit.results;
  const staticNs = `static-forever-${region}`;
  const enc = encodeURIComponent(q);
  const search = (type: string, path: string) =>
    withTimeout(api(`${host}/data/wow/search/${path}?namespace=${staticNs}&name.ko_KR=${enc}&_pageSize=100&orderby=id`, token))
      .then((r) => (r.body?.results ?? []).map((x: any) => ({
        type, id: x?.data?.id, name: x?.data?.name?.ko_KR ?? x?.data?.name?.en_US ?? null,
        quality: x?.data?.quality?.type ?? null,
      })).filter((x: any) => x.id && x.name))
      .catch(() => [] as any[]);
  const achievements = loadAchievements(host, staticNs, token)
    .then((list) => list.filter((a) => a.name.includes(q)).slice(0, 8).map((a) => ({ type: "achievement", id: a.id, name: a.name, quality: null })))
    .catch(() => [] as any[]);
  const quests = serviceClient().rpc("wow_quest_search", { p_query: q, p_limit: 8 })
    .then(({ data }: any) => (data ?? []).map((x: any) => ({ type: "quest", id: x.id, name: x.title, quality: null, area: x.area })))
    .catch(() => [] as any[]);
  const groups = await Promise.all([quests, search("item", "item"), search("npc", "creature"), search("spell", "spell"), achievements]);
  // 이름이 검색어를 통째로 포함하는 것 먼저 (블리자드 검색은 단어 하나만 맞아도 걸려서)
  const qs = q.replace(/\s+/g, "");
  const score = (n: string) => { const ns = n.replace(/\s+/g, "");
    return (ns === qs ? 0 : ns.startsWith(qs) ? 1 : ns.includes(qs) ? 2 : 3) * 1000 + n.length; };
  const seen = new Set<string>();
  const results = groups.flat()
    .filter((x: any) => { const k = x.type + ":" + x.id; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a: any, b: any) => score(a.name) - score(b.name))
    .slice(0, 20);
  searchCache.set(key, { exp: Date.now() + 6 * 3600_000, results });
  if (searchCache.size > 2000) searchCache.delete(searchCache.keys().next().value!);
  return results;
}

async function itemDetail(id: number, host: string, region: string, token: string) {
  const r = await withTimeout(api(`${host}/data/wow/item/${id}?namespace=static-forever-${region}&locale=ko_KR`, token), 5000);
  if (r.status !== 200) return { error: `아이템 정보를 찾지 못했어요 (${r.status})` };
  const b = r.body, p = b.preview_item ?? {};
  return {
    id: b.id, name: b.name, quality: b.quality?.type, quality_name: b.quality?.name,
    item_level: b.level, required_level: b.required_level,
    class: b.item_class?.name, subclass: b.item_subclass?.name, slot: b.inventory_type?.name,
    binding: p.binding?.name ?? null,
    armor: p.armor?.display?.display_string ?? null,
    weapon: p.weapon ? { damage: p.weapon.damage?.display_string, speed: p.weapon.attack_speed?.display_string, dps: p.weapon.dps?.display_string } : null,
    stats: (p.stats ?? []).map((s: any) => s.display?.display_string).filter(Boolean),
    spells: (p.spells ?? []).map((s: any) => s.description).filter(Boolean),
    requirements: p.requirements?.level?.display_string ?? null,
    sell_price: p.sell_price?.display_strings ? Object.values(p.sell_price.display_strings).join(" ") : null,
    wowhead: `https://www.wowhead.com/forever/ko/item=${b.id}`,
  };
}

async function questDetail(id: number, host: string, region: string, token: string) {
  const r = await withTimeout(api(`${host}/data/wow/quest/${id}?namespace=static-forever-${region}&locale=ko_KR`, token), 5000);
  if (r.status !== 200) return { error: `퀘스트 정보를 찾지 못했어요 (${r.status})` };
  const b = r.body, rw = b.rewards ?? {}, rq = b.requirements ?? {};
  return {
    id: b.id, title: b.title, zone: b.area?.name ?? b.category?.name ?? null,
    description: String(b.description ?? "").replace(/\{(class|race|name)\}/g, "모험가").slice(0, 900),
    requirements: { level: rq.min_character_level ?? rq.level ?? null, faction: rq.faction?.name ?? null,
      classes: (rq.classes ?? []).map((c: any) => c.name), races: (rq.races ?? []).map((c: any) => c.name),
      previous: rq.previous_quest ?? null },
    rewards: { experience: rw.experience ?? null, money: rw.money?.value ?? null,
      items: [...(rw.items?.items ?? []), ...(rw.items?.choice_of ?? [])].map((i: any) => i.item?.name ?? i.name).filter(Boolean),
      reputations: (rw.reputations ?? []).map((x: any) => `${x.reward?.name} +${x.value}`) },
    link: `[[quest:${b.id}::${b.title}]]`,
    wowhead: `https://www.wowhead.com/forever/ko/quest=${b.id}`,
  };
}

async function syncQuests(host: string, region: string, token: string) {
  const ns = `static-forever-${region}`;
  const lists: { kind: string; path: string; name: string }[] = [];
  for (const [kind, idx, key] of [["area", "area", "areas"], ["category", "category", "categories"]] as const) {
    const r = await api(`${host}/data/wow/quest/${idx}/index?namespace=${ns}&locale=ko_KR`, token);
    for (const a of r.body?.[key] ?? []) lists.push({ kind, path: `/data/wow/quest/${idx}/${a.id}`, name: a.name });
  }
  const rows: any[] = [];
  for (let i = 0; i < lists.length; i += 10) {
    await Promise.all(lists.slice(i, i + 10).map(async (l) => {
      const r = await api(`${host}${l.path}?namespace=${ns}&locale=ko_KR`, token).catch(() => null);
      for (const q of r?.body?.quests ?? []) rows.push({ id: q.id, title: q.name, area: l.name, kind: l.kind });
    }));
  }
  rows.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "category" ? -1 : 1)); // 지역이 나중에 덮어씀
  const sb = serviceClient(); let saved = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data } = await sb.rpc("wow_quest_upsert", { p_rows: rows.slice(i, i + 500) });
    saved += Number(data ?? 0);
  }
  return { lists: lists.length, quests: rows.length, saved };
}

async function syncQuestDetails(host: string, region: string, token: string, limit: number) {
  const sb = serviceClient();
  const { data: ids } = await sb.rpc("wow_quest_ids_pending", { p_limit: limit });
  const list: number[] = (ids ?? []).map((x: any) => Number(typeof x === "object" ? Object.values(x)[0] : x));
  const rows: any[] = []; let fail = 0;
  for (let i = 0; i < list.length; i += 25) {
    await Promise.all(list.slice(i, i + 25).map(async (qid) => {
      const r = await api(`${host}/data/wow/quest/${qid}?namespace=static-forever-${region}&locale=ko_KR`, token).catch(() => null);
      if (!r || r.status !== 200) { fail++; rows.push({ id: qid, description: null }); return; }
      const rq = r.body.requirements ?? {};
      rows.push({ id: qid, description: String(r.body.description ?? "").replace(/\{(class|race|name)\}/g, "모험가").slice(0, 2000),
        faction: rq.faction?.name ?? null, min_level: rq.min_character_level ?? null });
    }));
  }
  let saved = 0;
  for (let i = 0; i < rows.length; i += 300) {
    const { data } = await sb.rpc("wow_quest_detail_save", { p_rows: rows.slice(i, i + 300) }); saved += Number(data ?? 0);
  }
  return { requested: list.length, saved, fail };
}

// ---------- 포에버봇 ----------
const tokenOf = (x: any) => `[[${x.type}:${x.id}:${x.quality ?? ""}:${x.name}]]`;
const KIND = { quest: "퀘스트", item: "아이템", npc: "NPC", spell: "주문", achievement: "업적" } as Record<string, string>;

const BOT_SYSTEM = `너는 "와우 포에버(World of Warcraft: Forever)" 한국 팬 채팅방의 도우미 봇 "포에버봇"이야.
질문은 대부분 지금 게임하다 막힌 것들이야. 예: "가시멧돼지 어디 있어요", "가르톡 어디 있어요", "멀록 지느러미 어디서 구해요", "이 퀘 뭐 하라는 거예요".
채팅방에 올라온 글에 대한 질문도 받아. 예: "힐러 구하는 파티 있어?", "힐러가 갈 만한 던전 알려줘", "아까 누가 뭐 판다고 했지?".

찾는 방법:
- 몬스터·NPC·퀘스트 아이템 이름이 나오면 먼저 find_quests(words=그 이름)로 찾아. 퀘스트 설명에 그 이름이 나오는 퀘스트의 지역과 설명 속 단서(예: "서쪽 언덕", "호숫가")가 곧 답이야. 지역을 말했으면 zone도 넣어.
- 퀘스트 이름을 말하면 search_game_data로 찾고 get_quest로 내용(지역, 할 일, 보상)을 확인해.
- 운영진 자료(search_knowledge)도 같이 찾아봐.
- 검색이 안 되면 한국 공식 표기로 바꿔서 한 번 더 찾아 (예: 쓰랄→스랄, 실바나스, 오그리마, 스톰윈드). 단어를 바꿔 다시 찾는 건 한 번까지만, get_quest는 많아야 2번까지만.
- 같은 몬스터·NPC가 여러 지역 퀘스트에 나오면 "모르겠다"고 하지 말고 지역들을 짧게 다 말해 (예: "듀로타의 칼바위 언덕 근처([[quest:837::영토 침범]])와 붉은구름 고원 동쪽 칼날가시 협곡([[quest:780::전투멧돼지]])에 있어요").
- 찾은 자료가 조금이라도 질문과 맞으면 그걸로 답해. "확인된 정보가 없어요"는 관련 자료가 정말 하나도 없을 때만 써.

채팅방 글 찾기 (search_chat):
- 파티·거래·길드 모집이나 "누가 ~했지" 같이 채팅방에 올라온 글에 관한 질문이면 search_chat으로 찾아. 이건 게임 자료가 아니라 같은 진영 사람들이 최근에 쓴 글이야.
- 파티 모집은 tag="party", 거래는 "trade", 길드는 "guild". 말머리 없이 쓴 글도 많으니 tag로 못 찾으면 tag 없이 words로 한 번 더 찾아.
- words에는 핵심 단어만 1~4개 (예: "힐 힐러 사제", "탱", "화심", "검은바위"). 여러 개면 하나만 맞아도 걸려. 처음엔 hours=6, 없으면 hours=24로 한 번 더.
- 답할 땐 누가(이름) 언제(몇 분 전) 무엇을 구하는지 2~4개까지 짧게 정리해. "힐러가 갈 만한" 처럼 고르는 질문이면 글 내용으로 판단해서 맞는 것만 골라. 글에 없는 내용(자리가 남았는지, 레벨 조건 등)은 지어내지 마.
- 찾은 글이 없으면 "최근 채팅방에 그런 글이 없어요. 파티 말머리로 직접 올려 보세요!"라고 답해.

가장 중요한 규칙:
- 게임 플레이 정보(퀘스트, 위치, 보상, 레벨, 드랍, 일정, 수치)는 반드시 도구로 찾은 자료에만 근거해. 네가 원래 알던 와우 지식은 포에버와 다를 수 있으니 이런 건 지어내지 마.
- 인물·종족·지역의 배경 이야기(예: "쓰랄은 누구예요", "언데드는 왜 호드예요")는 네 와우 세계관 지식으로 짧게 답해도 돼. 이때는 바닐라(오리지널) 시점 기준으로 말하고, 관련 퀘스트를 찾았으면 링크도 붙여.
- 퀘스트 설명(대사)을 그대로 옮기지 말고, 할 일·장소·조건·보상만 짧게 뽑아서 말해. 레벨 조건이 자료에 없으면 "필요 레벨은 퀘스트 링크에서 확인해 주세요"처럼 한 마디로만.
- 블리자드 데이터에는 NPC·몬스터 좌표가 없어. 지역과 설명 속 단서까지만 말하고, 정확한 위치는 퀘스트 링크를 누르면 와우헤드 지도에서 볼 수 있다고 해.
- 자료로 답할 수 없는 게임 플레이 질문(서버 분위기, 직업 추천, 사람 경험담 같은 것)이나 못 찾은 질문은 지어내지 말고 딱 한 문장으로 "확인된 정보가 없어요. 질문 말머리로 올리면 채팅방 분들이 답해 주실 거예요!"라고만 답해.
- 질문과 관계없는 검색 결과는 아예 언급하지 마. 네가 무엇을 찾았거나 찾지 않았는지에 대한 설명, 되묻기는 하지 마. 질문에 대한 답만 해.

답변 형식:
- 한국어, 친근한 존댓말. 2~3문장, 200자 이내 (채팅방 글을 정리할 때는 300자까지). 채팅이라 마크다운(**굵게**, # 제목, 목록 기호)은 쓰지 마.
- 퀘스트/아이템/NPC를 말할 땐 도구 결과의 link 값을 그대로 붙여 써 (예: [[quest:837::영토 침범]]). 직접 만들어 쓰지 마.
- 채팅방 사람을 말할 땐 이름 앞에 @를 붙여 (예: @레골라스). 누르면 프로필이 열려.
- 주소는 괄호로 감싸지 말고 앞뒤에 띄어쓰기를 둬. 운영진 자료를 썼으면 마지막에 출처 주소를 붙여.`;

const BOT_TOOLS = [
  { name: "search_knowledge", description: "운영진이 직접 확인해서 정리한 와우 포에버 자료(공략, 일정, FAQ)를 찾는다.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "찾을 단어들" } }, required: ["query"] } },
  { name: "search_game_data", description: "블리자드 공식 포에버 데이터에서 퀘스트·아이템·NPC·주문·업적을 이름으로 찾는다. 퀘스트는 지역(area)도 같이 나온다. 결과의 link 값을 답에 그대로 쓴다.",
    input_schema: { type: "object", properties: { query: { type: "string", description: "이름 일부 (예: 천둥, 늑대)" } }, required: ["query"] } },
  { name: "find_quests", description: "퀘스트 제목과 설명(대사)에서 단어로 퀘스트를 찾는다. 몬스터·아이템·NPC 이름처럼 퀘스트 내용에 나올 단어를 넣고, 지역을 알면 zone도 넣는다. 단어는 적을수록 잘 걸린다(예: words='멧돼지', zone='듀로타').",
    input_schema: { type: "object", properties: { words: { type: "string", description: "공백으로 구분한 단어 1~3개" }, zone: { type: "string" } }, required: ["words"] } },
  { name: "list_zone_quests", description: "지역 이름으로 그 지역의 포에버 퀘스트 목록(번호, 이름)을 가져온다. '듀로타에서 멧돼지 잡는 퀘'처럼 퀘스트 이름을 모를 때 지역 목록에서 후보를 고른 뒤 get_quest로 확인한다.",
    input_schema: { type: "object", properties: { zone: { type: "string", description: "지역 이름 (예: 듀로타, 엘윈 숲)" } }, required: ["zone"] } },
  { name: "search_chat", description: "질문한 사람과 같은 서버·같은 진영 채팅방에 최근 올라온 글(파티 모집, 거래, 길드 모집, 잡담)을 찾는다. 질문한 사람 본인 글과 차단 관계인 사람 글은 빠진다. 결과는 최근 글이 먼저, 단어가 많이 맞는 글이 먼저다.",
    input_schema: { type: "object", properties: {
      words: { type: "string", description: "공백으로 구분한 핵심 단어 0~4개. 하나만 맞아도 걸린다 (예: '힐 힐러 사제')" },
      tag: { type: "string", enum: ["party", "trade", "guild", "question", "chat"], description: "말머리로 거르기 (없으면 전체)" },
      hours: { type: "integer", description: "몇 시간 전까지 (기본 6, 최대 72)" } } } },
  { name: "get_quest", description: "퀘스트 번호로 블리자드 공식 포에버 퀘스트 상세(지역, 설명, 필요 레벨, 선행 퀘스트, 보상)를 가져온다.",
    input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] } },
  { name: "get_item", description: "아이템 번호로 블리자드 공식 포에버 아이템 상세(등급, 레벨, 능력치, 효과)를 가져온다.",
    input_schema: { type: "object", properties: { id: { type: "integer" } }, required: ["id"] } },
];

const TAG_KO: Record<string, string> = { chat: "잡담", question: "질문", trade: "거래", guild: "길드", party: "파티" };
const agoKo = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return min < 1 ? "방금" : min < 60 ? `${min}분 전` : `${Math.floor(min / 60)}시간 ${min % 60}분 전`;
};

type Ctx = { host: string; region: string; token: string; sb: any; kbIds: Set<number>; trace?: any[];
  asker?: string; channel?: string; usedChat?: boolean };
async function runTool(name: string, input: any, ctx: Ctx) {
  try {
    if (name === "search_knowledge") {
      const { data } = await ctx.sb.rpc("wow_kb_search", { p_query: String(input?.query ?? ""), p_limit: 4 });
      (data ?? []).forEach((k: any) => ctx.kbIds.add(Number(k.id)));
      return (data ?? []).map((k: any) => ({ title: k.title, body: String(k.body).slice(0, 1200), source: k.source_url }));
    }
    if (name === "search_game_data") {
      const res = await searchGame(String(input?.query ?? ""), ctx.host, ctx.region, ctx.token);
      return res.slice(0, 10).map((x: any) => ({ kind: KIND[x.type] ?? x.type, id: x.id, name: x.name, quality: x.quality, area: x.area, link: tokenOf(x) }));
    }
    if (name === "find_quests") {
      const { data } = await ctx.sb.rpc("wow_quest_find", { p_words: String(input?.words ?? ""), p_zone: input?.zone ? String(input.zone) : null, p_limit: 12 });
      return (data ?? []).map((q: any) => ({ id: q.id, title: q.title, zone: q.area, faction: q.faction, snippet: q.snippet, link: `[[quest:${q.id}::${q.title}]]` }));
    }
    if (name === "list_zone_quests") {
      const { data } = await ctx.sb.rpc("wow_quest_by_area", { p_area: String(input?.zone ?? ""), p_limit: 150 });
      return (data ?? []).map((q: any) => `${q.id}:${q.title}`).join(", ") || "그런 지역을 찾지 못했어요";
    }
    if (name === "search_chat") {
      if (!ctx.asker || !ctx.channel) return { error: "채팅방 정보가 없어요" };
      ctx.usedChat = true;
      const { data, error } = await ctx.sb.rpc("wow_bot_chat_search", { p_asker: ctx.asker, p_channel: ctx.channel,
        p_words: input?.words ? String(input.words).slice(0, 60) : null, p_tag: input?.tag ? String(input.tag) : null,
        p_hours: Number(input?.hours ?? 6) || 6, p_limit: 20 });
      if (error) return { error: error.message };
      if (!data?.length) return "최근 글 중에 맞는 게 없어요";
      return data.map((m: any) => ({ who: m.sender_name, cls: m.sender_class, lv: m.sender_level,
        tag: TAG_KO[m.tag] ?? m.tag, when: agoKo(m.created_at), reply: m.is_reply || undefined, text: m.body,
        replies: m.reply_count || undefined }));
    }
    if (name === "get_quest") return await questDetail(Number(input?.id), ctx.host, ctx.region, ctx.token);
    if (name === "get_item") {
      const d: any = await itemDetail(Number(input?.id), ctx.host, ctx.region, ctx.token);
      if (!d.error) d.link = tokenOf({ type: "item", id: d.id, quality: d.quality, name: d.name });
      return d;
    }
  } catch (e) { return { error: String((e as Error)?.message ?? e) }; }
  return { error: "unknown tool" };
}

async function askClaude(question: string, asker: string, ctx: Ctx) {
  const key = Deno.env.get("FOREVER_BOT_PROD_ANTHROPIC_KEY")?.trim();
  if (!key) return null;
  const model = Deno.env.get("FOREVER_BOT_MODEL") ?? "claude-haiku-5-5";
  const now = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
  const messages: any[] = [{ role: "user", content: `(지금 한국 시각 ${now})\n${asker}님의 질문: ${question}` }];
  for (let turn = 0; turn < 6; turn++) {
    const r = await withTimeout(fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1024,
        system: [{ type: "text", text: BOT_SYSTEM, cache_control: { type: "ephemeral" } }],
        tools: BOT_TOOLS.map((t, i) => i === BOT_TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t),
        messages }),
    }), 25000);
    const d = await r.json();
    if (!r.ok) throw new Error(`AI 오류 (${r.status}) ${d?.error?.message ?? ""}`);
    messages.push({ role: "assistant", content: d.content });
    ctx.trace?.push({ stop: d.stop_reason, usage: d.usage?.output_tokens });
    const uses = (d.content ?? []).filter((c: any) => c.type === "tool_use");
    if (d.stop_reason !== "tool_use" || !uses.length) {
      const text = (d.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n").trim();
      return text || "확인된 정보가 없어요. 질문 말머리로 올리면 채팅방 분들이 답해 주실 거예요!";
    }
    const results = await Promise.all(uses.map(async (u: any) => {
      const out = JSON.stringify(await runTool(u.name, u.input, ctx)).slice(0, 8000);
      ctx.trace?.push({ tool: u.name, input: u.input, result: out.slice(0, 300) });
      return { type: "tool_result", tool_use_id: u.id, content: out };
    }));
    messages.push({ role: "user", content: results });
  }
  return "자료를 찾는 데 시간이 너무 걸렸어요. 질문을 조금 더 짧게 해 주세요.";
}

const plain = (t: string) => t.replace(/\[\[(?:quest|item|npc|spell|achievement):\d+:[A-Z_]*:([^\]\n]{1,60})\]\]/g, "[$1]");
// 채팅방 글을 찾는 질문 (이런 건 예전 답을 다시 쓰면 안 된다)
const CHAT_Q = /파티|구하|구인|모집|힐러|탱커|딜러|거래|판매|구매|팝니다|삽니다|길드|누가|아까|방금|채팅/;

async function handleBot(tokenStr: string, messageId: number, host: string, region: string, appToken: string) {
  const sb = serviceClient();
  const { data: m } = await sb.rpc("wow_bot_claim", { p_token: tokenStr, p_message_id: messageId });
  if (!m) return { ok: false, reason: "not_claimed" };
  const body: string = String(m.body ?? "").trim();
  const asker: string = m.sender_name;
  const ctx: Ctx = { host, region, token: appToken, sb, kbIds: new Set<number>(), asker: m.player_id, channel: m.channel };
  const say = async (text: string) => { await sb.rpc("wow_bot_post", { p_channel: m.channel, p_body: text, p_reply_to: m.id }); return { ok: true }; };

  if (body.startsWith("!") || body.includes("@" + BOT_NAME) || /(^|\s)@봇(\s|$)/.test(body)) {
    const question = plain(body).replace(/^!\S*\s*/, (x) => /^!(도움|도움말|help|명령어)\s*$/.test(x) ? "" : x.slice(1))
      .replace("@" + BOT_NAME, "").replace(/(^|\s)@봇(\s|$)/, " ").trim();
    if (!question) return say(`@${asker} 와우 포에버에 대해 궁금한 걸 @포에버봇 뒤에 써 주세요. 확인된 자료로만 답해요.`);
    // 1) 비슷한 질문에 이미 답한 게 있으면 AI 없이 그대로 (무료). 채팅방 글을 묻는 질문은 매번 새로 찾는다
    if (!CHAT_Q.test(question)) {
      const { data: cached } = await sb.rpc("wow_bot_cache_lookup", { p_question: question });
      if (cached?.answer) return say(`@${asker} ${cached.answer}`);
    }
    // 2) 상한 확인
    const { data: allow } = await sb.rpc("wow_bot_ai_allow", { p_player: m.player_id });
    if (allow === "cooldown") return say(`@${asker} 조금만 천천히요! 30초 뒤에 다시 물어봐 주세요.`);
    if (allow === "monthly_cap") return say(`@${asker} 이번 달 배터리를 다 썼어요 🪫 포에버봇을 눌러 충전해 주시면 다시 답할 수 있어요!`);
    if (allow === "daily_cap") return say(`@${asker} 오늘 받을 수 있는 질문을 다 받았어요. 내일 다시 물어봐 주세요!`);
    let answer: string | null = null;
    try { answer = await askClaude(question, asker, ctx); } catch (e) { console.error(e); answer = null; }
    // 3) 기록: 모른다고 했으면 '못 답한 질문'으로, 답했으면 다음에 재사용 (채팅방 글로 답한 건 재사용하지 않게 stale)
    if (answer) {
      const unknown = /확인된 정보가 없어요|정보가 없어요|모르겠어요|찾지 못했어요/.test(answer);
      await sb.rpc("wow_bot_log", { p_question: question, p_asker: m.player_id, p_asker_name: asker, p_channel: m.channel,
        p_status: ctx.usedChat ? "stale" : unknown ? "unanswered" : "answered", p_answer: answer, p_kb_ids: [...ctx.kbIds] });
    }
    if (!answer) {
      const { data } = await sb.rpc("wow_kb_search", { p_query: question, p_limit: 1 });
      answer = data?.length ? `정리된 자료에서 찾은 내용이에요. 📌 ${data[0].title}: ${String(data[0].body).slice(0, 200)}${data[0].source_url ? " " + data[0].source_url : ""}`
        : "지금은 답변을 할 수 없어요. 잠시 뒤에 다시 물어봐 주세요.";
    }
    return say(`@${asker} ${answer.replace(/\*\*/g, "")}`);
  }
  return { ok: true, skipped: "not_for_bot" };
}

const factionOf = (t?: string) => t === "HORDE" ? "horde" : t === "ALLIANCE" ? "alliance" : null;

function kindOf(x: any): "일반" | "PvP" | null {
  if (!x || typeof x !== "object") return null;
  const texts = [x?.type?.type, x?.type?.name, x?.ruleset?.name, x?.ruleset?.type, x?.category, x?.name]
    .filter((s) => typeof s === "string").map((s: string) => s.toLowerCase());
  for (const t of texts) {
    if (t.includes("pvp") || t.includes("전투")) return "PvP";
    if (t.includes("normal") || t.includes("일반") || t === "pve") return "일반";
  }
  const rid = x?.ruleset?.id;
  if (rid === 1) return "PvP";
  if (rid === 2) return "일반";
  return null;
}

function protectedIds(c: any): { realmId: number; charId: number } | null {
  const href: string = c?.protected_character?.href ?? "";
  const m = href.match(/protected-character\/(\d+)-(\d+)/);
  return m ? { realmId: Number(m[1]), charId: Number(m[2]) } : null;
}

function displayName(c: any): string {
  const n = String(c?.name ?? "").trim();
  const s = String(c?.surname ?? "").trim();
  if (n && s) return `${n} ${s}`;
  const href: string = c?.character?.href ?? "";
  const m = href.match(/\/profile\/wow\/character\/([^/?]+)(\?|$)/);
  if (m) { const last = decodeURIComponent(m[1]); if (last.includes("-")) return last.split("-").join(" "); }
  return n || "?";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const id = Deno.env.get("BLIZZARD_CLIENT_ID")?.trim();
  const secret = Deno.env.get("BLIZZARD_CLIENT_SECRET")?.trim();
  if (!id || !secret) return json({ ok: false, reason: "not_configured" });

  const url = new URL(req.url);
  const region = (url.searchParams.get("region") ?? Deno.env.get("BLIZZARD_REGION") ?? "kr").toLowerCase();
  const host = `https://${region}.api.blizzard.com`;
  const profileNs = `profile-forever-${region}`;
  const dynamicNs = `dynamic-forever-${region}`;
  const action = url.searchParams.get("action");
  const allowed = (Deno.env.get("ALLOWED_REDIRECTS") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
    .concat(DEFAULT_REDIRECTS);

  try {
    if (action === "login_url") {
      const redirect = url.searchParams.get("redirect_uri") ?? "";
      const state = url.searchParams.get("state") ?? "";
      if (!allowed.includes(redirect)) return json({ ok: false, reason: "bad_redirect", message: "허용되지 않은 주소예요: " + redirect }, 400);
      const q = new URLSearchParams({ client_id: id, redirect_uri: redirect, response_type: "code",
        scope: "openid wow.profile", state });
      return json({ ok: true, url: `https://oauth.battle.net/authorize?${q}` });
    }

    if (action === "exchange") {
      const b = await req.json().catch(() => ({}));
      const code = String(b.code ?? "");
      const redirect = String(b.redirect_uri ?? "");
      if (!code || !allowed.includes(redirect)) return json({ ok: false, reason: "bad_request", message: "잘못된 로그인 요청이에요" }, 400);

      const tr = await fetch("https://oauth.battle.net/token", {
        method: "POST",
        headers: { Authorization: "Basic " + btoa(`${id}:${secret}`), "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirect, scope: "openid wow.profile" }),
      });
      if (!tr.ok) return json({ ok: false, reason: "token_failed", message: `배틀넷 로그인 처리 실패 (${tr.status}). 다시 시도해 주세요` });
      const userToken = (await tr.json()).access_token as string;

      const ui = await api("https://oauth.battle.net/userinfo", userToken).catch(() => ({ status: 0, body: null }));
      const battletag: string | null = ui.body?.battletag ?? null;
      const sub: string | null = (ui.body?.sub ?? ui.body?.id)?.toString() ?? null;
      if (!sub) return json({ ok: false, reason: "userinfo_failed", message: "배틀넷 계정 정보를 못 받았어요. 다시 로그인해 주세요" });

      const acc = await api(`${host}/profile/user/wow?namespace=${profileNs}&locale=ko_KR`, userToken);
      if (acc.status !== 200) {
        return json({ ok: false, reason: "account_failed", status: acc.status,
          message: acc.status === 404 ? "이 계정에서 포에버 캐릭터를 찾지 못했어요"
            : `블리자드가 캐릭터 목록을 주지 않았어요 (${acc.status})` });
      }
      const chars = (acc.body?.wow_accounts ?? []).flatMap((a: any) => a.characters ?? []);

      const debug: any[] = [];
      const kindByRealm = new Map<number, "일반" | "PvP" | null>();
      const list: any[] = [];
      for (const c of chars) {
        const faction = factionOf(c.faction?.type);
        if (!faction) continue;
        const ids = protectedIds(c);
        let realm = kindOf(c.realm) ?? kindOf({ ruleset: c.ruleset });
        if (!realm && ids) {
          if (!kindByRealm.has(ids.realmId)) {
            const p = await api(`${host}/profile/user/wow/protected-character/${ids.realmId}-${ids.charId}?namespace=${profileNs}&locale=ko_KR`, userToken);
            const pc = p.body ?? {};
            const k = kindOf(pc?.character?.realm) ?? kindOf(pc?.realm) ?? kindOf({ ruleset: pc?.character?.ruleset ?? pc?.ruleset });
            kindByRealm.set(ids.realmId, k);
            if (debug.length < 2) debug.push({ realm_id: ids.realmId, status: p.status,
              keys: Object.keys(pc), character_realm: pc?.character?.realm ?? null, ruleset: pc?.character?.ruleset ?? pc?.ruleset ?? null });
          }
          realm = kindByRealm.get(ids.realmId) ?? null;
        }
        list.push({ name: displayName(c), race: c.playable_race?.name ?? null, class: c.playable_class?.name ?? null,
          faction, level: c.level ?? null, realm, realm_id: ids?.realmId ?? null });
      }
      // 캐릭터 그림(블리자드가 주면): /profile/wow/character/{이름}/character-media
      const mediaProbe: any[] = [];
      await Promise.all(chars.slice(0, 50).map(async (c: any) => {
        const href: string = c?.character?.href ?? "";
        const path = href.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
        const item = list.find((x) => x.name === displayName(c));
        if (item) item.gender = c?.gender?.type ?? null;
        if (!path || !item) return;
        try {
          const r = await withTimeout(api(`${host}${path}/character-media?namespace=${profileNs}&locale=ko_KR`, userToken), 3000);
          if (mediaProbe.length < 2) mediaProbe.push({ path, status: r.status, body: r.body });
          const assets: any[] = r.body?.assets ?? [];
          const pickA = (k: string) => assets.find((a) => a.key === k)?.value;
          item.avatar = pickA("avatar") ?? pickA("inset") ?? r.body?.avatar_url ?? null;
          item.render = pickA("main-raw") ?? pickA("main") ?? r.body?.render_url ?? null;
        } catch (e) { if (mediaProbe.length < 2) mediaProbe.push({ path, error: String(e) }); }
      }));
      serviceClient().rpc("wow_debug_save", { p_kind: "media_probe", p_data: mediaProbe }).then(() => {}, () => {});
      list.sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
      if (!list.length) return json({ ok: false, reason: "no_characters", message: "이 계정에 포에버 캐릭터가 없어요" });

      const rawSample = chars[0] ? { character: chars[0], protected_lookup: debug } : null;
      const { data: accountToken, error } = await serviceClient().rpc("wow_upsert_account",
        { p_sub: sub, p_battletag: battletag, p_characters: list.slice(0, 50), p_raw: rawSample });
      if (error) return json({ ok: false, reason: "db_error", message: "저장 실패: " + error.message });
      return json({ ok: true, account_token: accountToken, battletag });
    }

    // Buy Me a Coffee 웹훅: 후원이 들어오면 포에버봇 배터리 충전. 주소의 key가 DB의 webhook_key와 같아야 받음
    if (action === "bmc") {
      if (req.method !== "POST") return json({ ok: false }, 405);
      const text = (await req.text()).slice(0, 65536);
      let payload: unknown = null;
      try { payload = JSON.parse(text); } catch {
        try { payload = Object.fromEntries(new URLSearchParams(text)); } catch { payload = null; }
      }
      if (!payload || typeof payload !== "object") payload = { unparsed: text.slice(0, 4000) };
      const { data, error } = await serviceClient().rpc("wow_bot_charge", { p_key: url.searchParams.get("key") ?? "", p_payload: payload });
      if (error) return json({ ok: false, reason: "db" }, 500);
      if (!data?.ok) return json({ ok: false }, 401);
      return json({ ok: true });
    }

    const token = await getAppToken(id, secret);

    if (action === "search") {
      const results = await searchGame(url.searchParams.get("q") ?? "", host, region, token);
      return json({ ok: true, results }, 200, true);
    }

    if (action === "quest") {
      const qid = Number(url.searchParams.get("id"));
      if (!Number.isInteger(qid) || qid <= 0) return json({ ok: false, reason: "bad_request" }, 400);
      const d: any = await questDetail(qid, host, region, token).catch((e) => ({ error: String(e) }));
      return json({ ok: !d.error, quest: d }, 200, !d.error);
    }

    if (action === "bot") {
      const b = await req.json().catch(() => ({}));
      const tok = String(b.token ?? ""); const mid = Number(b.message_id);
      if (!/^[0-9a-f-]{36}$/i.test(tok) || !Number.isFinite(mid)) return json({ ok: false, reason: "bad_request" }, 400);
      return json(await handleBot(tok, mid, host, region, token));
    }

    if (action === "bot_test") {
      const sb = serviceClient();
      const { data: ok } = await sb.rpc("wow_bot_test_key_ok", { p_key: url.searchParams.get("key") ?? "" });
      if (!ok) return json({ ok: false, reason: "forbidden" }, 403);
      const q = (url.searchParams.get("q") ?? "").slice(0, 200);
      const ctx: Ctx = { host, region, token, sb, kbIds: new Set<number>(), trace: [],
        asker: url.searchParams.get("asker") ?? undefined, channel: url.searchParams.get("channel") ?? "general" };
      const answer = await askClaude(q, "테스트", ctx).catch((e) => "ERROR " + e);
      return json({ q, answer: answer?.replace(/\*\*/g, ""), trace: ctx.trace });
    }

    if (action === "sync_quests") {
      const { data: ok } = await serviceClient().rpc("wow_bot_test_key_ok", { p_key: url.searchParams.get("key") ?? "" });
      if (!ok) return json({ ok: false, reason: "forbidden" }, 403);
      return json(await syncQuests(host, region, token));
    }

    if (action === "sync_quest_details") {
      const { data: ok } = await serviceClient().rpc("wow_bot_test_key_ok", { p_key: url.searchParams.get("key") ?? "" });
      if (!ok) return json({ ok: false, reason: "forbidden" }, 403);
      return json(await syncQuestDetails(host, region, token, Math.min(Number(url.searchParams.get("limit") ?? 800), 1500)));
    }

    if (action === "probe") {
      const { data: ok } = await serviceClient().rpc("wow_bot_test_key_ok", { p_key: url.searchParams.get("key") ?? "" });
      if (!ok) return json({ ok: false, reason: "forbidden" }, 403);
      const path = (url.searchParams.get("path") ?? "").replace(/[^a-z0-9/_\-]/gi, "");
      const ns = url.searchParams.get("ns") ?? `static-forever-${region}`;
      const extra = (url.searchParams.get("extra") ?? "").replace(/[^a-z0-9=&_.\-%]/gi, "");
      const r = await api(`${host}${path}?namespace=${ns}&locale=ko_KR${extra ? "&" + extra : ""}`, token);
      return json({ status: r.status, body: r.body });
    }

    if (url.searchParams.get("media")) {
      const slug = encodeURIComponent(url.searchParams.get("media")!.trim().replace(/\s+/g, "-").toLowerCase());
      const r = await api(`${host}/profile/wow/character/${slug}/character-media?namespace=${profileNs}&locale=ko_KR`, token);
      return json({ status: r.status, body: r.body });
    }

    if (url.searchParams.get("realm_id")) {
      const rid = Number(url.searchParams.get("realm_id"));
      const out: any = {};
      for (const path of [`/data/wow/realm/${rid}`, `/data/wow/connected-realm/${rid}`]) {
        const r = await api(`${host}${path}?namespace=${dynamicNs}&locale=ko_KR`, token);
        out[path] = { status: r.status, body: r.body };
      }
      return json(out);
    }

    if (url.searchParams.get("rulesets") || url.searchParams.get("realms")) {
      const r = await api(`${host}/data/wow/ruleset/index?namespace=${dynamicNs}&locale=ko_KR`, token);
      return json({ ok: r.status === 200, namespace: dynamicNs, status: r.status, data: r.body });
    }

    const raw = (url.searchParams.get("name") ?? "").trim();
    if (!raw) return json({ ok: false, reason: "bad_request", message: "캐릭터 이름을 입력해 주세요" }, 400);
    const slug = raw.replace(/\s+/g, "-").toLowerCase();
    const r = await api(`${host}/profile/wow/character/${encodeURIComponent(slug)}?namespace=${profileNs}&locale=ko_KR`, token);
    if (r.status === 200) {
      const c = r.body;
      return json({ ok: true, character: {
        name: c.name ?? raw, race: c.race?.name ?? null, class: c.character_class?.name ?? null,
        faction: factionOf(c.faction?.type), level: c.level ?? null, guild: c.guild?.name ?? null,
        ruleset: kindOf(c.realm) ?? kindOf({ ruleset: c.ruleset }) } });
    }
    return json({ ok: false, reason: r.status === 404 ? "not_found" : "api_error", status: r.status,
      message: r.status === 404 ? "캐릭터를 찾지 못했어요" : `블리자드 API 오류 (${r.status})` });
  } catch (e) {
    return json({ ok: false, reason: "error", message: String((e as Error).message ?? e) });
  }
});
