# -*- coding: utf-8 -*-
"""docs/kintai_faq.md から閲覧用HTMLを生成する。

Q&Aの本文は kintai_faq.md が唯一の情報源。
md を直したらこれを実行して HTML を作り直し、Artifactへ再公開すること。
実行:  python3 docs/_build/build_faq_html.py
"""
import re, html, json

import os
HERE = os.path.dirname(os.path.abspath(__file__))
SRC  = os.path.join(HERE, "..", "kintai_faq.md")
TPL  = os.path.join(HERE, "faq_template.html")
OUT  = os.path.join(HERE, "kintai_faq.html")

md = open(SRC, encoding="utf-8").read()

def inline(t):
    t = html.escape(t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', t)
    return t

def blocks(lines):
    """段落・表・箇条書きをHTMLへ"""
    out, i = [], 0
    while i < len(lines):
        ln = lines[i]
        if not ln.strip():
            i += 1; continue
        # 表
        if ln.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                rows.append([c.strip() for c in lines[i].strip().strip('|').split('|')])
                i += 1
            head, body = rows[0], [r for r in rows[2:]]
            th = ''.join(f'<th>{inline(c)}</th>' for c in head)
            tb = ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in r) + '</tr>' for r in body)
            out.append(f'<div class="tw"><table><thead><tr>{th}</tr></thead><tbody>{tb}</tbody></table></div>')
            continue
        # 箇条書き
        if re.match(r'^[-*] ', ln):
            items = []
            while i < len(lines) and re.match(r'^[-*] ', lines[i]):
                items.append(f'<li>{inline(lines[i][2:])}</li>'); i += 1
            out.append('<ul>' + ''.join(items) + '</ul>'); continue
        if re.match(r'^\d+\. ', ln):
            items = []
            while i < len(lines) and re.match(r'^\d+\. ', lines[i]):
                txt = re.sub(r'^\d+\. ', '', lines[i])
                items.append('<li>' + inline(txt) + '</li>'); i += 1
            out.append('<ol>' + ''.join(items) + '</ol>'); continue
        # 引用
        if ln.startswith('> '):
            buf = []
            while i < len(lines) and lines[i].startswith('> '):
                buf.append(lines[i][2:]); i += 1
            out.append(f'<blockquote>{inline(" ".join(buf))}</blockquote>'); continue
        # 段落（連続行はまとめる）
        buf = []
        while i < len(lines) and lines[i].strip() and not lines[i].startswith(('|','>','#')) \
              and not re.match(r'^([-*]|\d+\.) ', lines[i]):
            buf.append(lines[i].strip()); i += 1
        if buf:
            out.append('<p>' + inline('<br>'.join(buf)).replace('&lt;br&gt;', '<br>') + '</p>')
    return ''.join(out)

def status_of(title):
    if '❌' in title: return 'no'
    if '🔶' in title: return 'tbd'
    if '✅' in title: return 'ok'
    return 'ok'

# ---- 分解 ----
parts = re.split(r'^## ', md, flags=re.M)
intro_raw = parts[0]
sections = []
for p in parts[1:]:
    lines = p.split('\n')
    stitle = lines[0].strip()
    rest = lines[1:]
    qs = re.split(r'^### ', '\n'.join(rest), flags=re.M)
    lead_parts = [blocks(qs[0].split('\n'))]
    items = []
    for q in qs[1:]:
        ql = q.split('\n')
        qtitle = ql[0].strip()
        m = re.match(r'^(Q[\d\-]+)\.\s*(.+?)\s*([✅🔶❌][^\n]*)?$', qtitle)
        if not m:
            # 設問ではない小見出し（例: 「現時点で非対応と明言してよいもの」）
            lead_parts.append('<h3 class="subh">' + html.escape(qtitle) + '</h3>' + blocks(ql[1:]))
            continue
        items.append({'id': m.group(1), 'q': m.group(2), 'mark': (m.group(3) or '').strip(),
                      'st': status_of(qtitle), 'body': blocks(ql[1:])})
    lead = ''.join(lead_parts)
    sections.append({'title': stitle, 'lead': lead, 'items': items})

# 「この資料の使い方」は導入として扱う
usage = [s for s in sections if 'この資料の使い方' in s['title']]
sections = [s for s in sections if 'この資料の使い方' not in s['title']]
usage_html = usage[0]['lead'] if usage else ''
intro_p = blocks([l for l in intro_raw.split('\n') if not l.startswith('#')])

counts = {'ok':0, 'tbd':0, 'no':0}
for s in sections:
    for it in s['items']:
        counts[it['st']] += 1

LABEL = {'ok':'対応済み', 'tbd':'仕様未確定', 'no':'非対応'}
MARK  = {'ok':'✅', 'tbd':'🔶', 'no':'❌'}

nav, body = [], []
for si, s in enumerate(sections):
    sid = f'sec{si}'
    num = s['title'].split('.')[0].strip()
    name = s['title'].split('.', 1)[1].strip() if '.' in s['title'] else s['title']
    nav.append(f'<a href="#{sid}" data-nav="{sid}"><span class="n">{html.escape(num)}</span>{html.escape(name)}</a>')
    cards = []
    for it in s['items']:
        cards.append(
            f'<article class="qa" data-st="{it["st"]}" data-txt="{html.escape(it["q"]+it["id"])}">'
            f'<div class="qh"><span class="qid">{html.escape(it["id"])}</span>'
            f'<h3>{inline(it["q"])}</h3>'
            f'<span class="chip {it["st"]}">{MARK[it["st"]]} {LABEL[it["st"]]}</span></div>'
            f'<div class="qb">{it["body"]}</div></article>')
    body.append(
        f'<section id="{sid}"><header class="sh"><span class="snum">{html.escape(num)}</span>'
        f'<h2>{html.escape(name)}</h2></header>{s["lead"]}'
        f'<div class="qs">{"".join(cards)}</div></section>')

TPL = open(TPL, encoding='utf-8').read()
out = (TPL.replace('{{NAV}}', ''.join(nav))
          .replace('{{BODY}}', ''.join(body))
          .replace('{{INTRO}}', intro_p)
          .replace('{{USAGE}}', usage_html)
          .replace('{{OK}}', str(counts['ok']))
          .replace('{{TBD}}', str(counts['tbd']))
          .replace('{{NO}}', str(counts['no']))
          .replace('{{TOTAL}}', str(sum(counts.values()))))
open(OUT, 'w', encoding='utf-8').write(out)
print(f"生成: {OUT}")
print(f"  セクション {len(sections)} / 設問 {sum(counts.values())}")
print(f"  ✅{counts['ok']}  🔶{counts['tbd']}  ❌{counts['no']}")
