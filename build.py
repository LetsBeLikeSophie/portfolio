"""포트폴리오 페이지 생성기.

src/template.html 하나와 src/projects.json(프로젝트 목록)을 바탕으로
src/pages/*.json 설정마다 페이지를 하나씩 만든다.

  - slug가 "home"인 설정 → home/index.html (itssophie.dev/home/, 일반 포트폴리오)
  - slug가 "hybe"인 설정 → hybe/index.html (itssophie.dev/hybe/)
  - slug가 ""인 설정(main.json) → 루트 index.html. "extends"에 적힌 페이지를 그대로 보여줌

외부 패키지 없이 `python3 build.py`로 실행한다.
"""

import json
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def project_card(p, note, note_label):
    target = ' target="_blank" rel="noopener"' if p["external"] else ""
    state = f'<span class="state {escape(p["state"])}">{escape(p["state_label"])}</span>'
    if p.get("badge"):
        state = f'<div class="state-row">{state}<span class="badge">{escape(p["badge"])}</span></div>'
    state = "            " + state
    lines = [
        f'          <article class="project" id="{escape(p["id"])}" data-stack="{escape(",".join(p["stack"]))}">',
        state,
        f'            <h3><a href="{escape(p["href"])}"{target}>{escape(p["name"])}</a></h3>',
        f'            <p>{escape(p["desc"])}</p>',
    ]
    if note:
        lines.append(
            f'            <div class="fit"><b>{escape(note_label)}</b>{escape(note)}</div>'
        )
    lines.append("          </article>")
    return "\n".join(lines)


def render(template, data, page):
    projects = {p["id"]: p for p in data["projects"]}
    order = page.get("order") or [p["id"] for p in data["projects"]]
    missing = [i for i in order if i not in projects]
    if missing:
        raise SystemExit(f"{page.get('slug') or 'main'}: 알 수 없는 프로젝트 id {missing}")
    # 순서에 빠진 프로젝트는 원래 순서대로 뒤에 붙인다
    order += [p["id"] for p in data["projects"] if p["id"] not in order]

    notes = page.get("notes", {})
    note_label = page.get("note_label", "")

    groups = []
    for g in data["groups"]:
        cards = [
            project_card(projects[i], notes.get(i), note_label)
            for i in order
            if projects[i]["group"] == g["id"]
        ]
        if not cards:
            continue
        groups.append(
            '      <section class="group">\n'
            f'        <div class="group-head"><h2>{escape(g["title"])}</h2><small>{escape(g["desc"])}</small></div>\n'
            '        <div class="grid">\n'
            + "\n\n".join(cards)
            + "\n        </div>\n      </section>\n"
        )

    focus = page.get("focus_stack", [])
    legend = ""
    if focus:
        legend = f'<span class="legend"><i aria-hidden="true"></i>{escape(page.get("focus_label", ""))}</span>'

    context = ""
    if page.get("context"):
        context = f'        <p class="context">{escape(page["context"])}</p>\n'

    # 루트(/)가 어떤 페이지를 보여줄지는 바뀔 수 있으므로, 모든 페이지의 하단 링크는 GitHub로 통일
    footer_link = '<a href="https://github.com/LetsBeLikeSophie" target="_blank" rel="noopener">github.com/LetsBeLikeSophie</a>'

    robots = "" if page.get("index", True) else '<meta name="robots" content="noindex, nofollow, noarchive" />\n'

    values = {
        "title": escape(page["title"]),
        "robots": robots,
        "focus": escape(",".join(focus)),
        "intro_lead": escape(page["intro_lead"]),
        "intro_sub": escape(page["intro_sub"]),
        "context": context,
        "focus_legend": legend,
        "groups": "\n".join(groups),
        "footer_link": footer_link,
    }
    out = template
    for k, v in values.items():
        out = out.replace("{{" + k + "}}", v)
    if "{{" in out:
        raise SystemExit("템플릿에 채워지지 않은 자리가 남아 있어요")
    return out


def main():
    template = (SRC / "template.html").read_text(encoding="utf-8")
    data = load(SRC / "projects.json")
    built = []
    for cfg in sorted((SRC / "pages").glob("*.json")):
        page = load(cfg)
        # "extends": "hybe" → 이 주소에서 그 회사 페이지 내용을 그대로 보여줌.
        # 주소(slug)만 이 파일 값을 유지하고, 내용과 검색 차단 여부는 회사 설정을 따름.
        # "extends" 줄을 지우면 이 파일에 적힌 원래 내용(검색 허용 포함)으로 돌아감.
        if page.get("extends"):
            base = load(SRC / "pages" / f'{page["extends"]}.json')
            page = {**page, **base, "slug": page.get("slug", "")}
        slug = page.get("slug", "")
        dest = ROOT / slug / "index.html" if slug else ROOT / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(render(template, data, page), encoding="utf-8")
        built.append(f"/{slug}/" if slug else "/")
    print("만든 페이지:", ", ".join(built))


if __name__ == "__main__":
    main()
