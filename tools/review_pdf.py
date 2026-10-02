#!/usr/bin/env python3
"""Renders the World 1 content script into a sharia-review PDF.
Usage: python3 tools/review_pdf.py <fonts_dir> <out.pdf>
"""
import json, sys, html, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONTS = pathlib.Path(sys.argv[1]).resolve()
OUT = pathlib.Path(sys.argv[2]).resolve()

S = json.loads((ROOT / "data/content/world1_script.json").read_text())
Q = json.loads((ROOT / "data/content/world1_quiz.json").read_text())
V = {v["key"]: v for v in json.loads((ROOT / "data/quran/verses.json").read_text())["verses"]}
e = html.escape

rows_html = []
counter = {"n": 0}

def section(title, note=""):
    rows_html.append(f'<h2>{e(title)}</h2>' + (f'<p class="note">{e(note)}</p>' if note else ""))

def row(label, tx, priority=False, extra=""):
    counter["n"] += 1
    n = counter["n"]
    cls = ' class="prio"' if priority else ""
    rows_html.append(
        f'<tr{cls}><td class="id">{n}<div class="lbl">{e(label)}</div></td>'
        f'<td class="ar">{e(tx["ar"])}{extra}</td><td class="en">{e(tx["en"])}</td>'
        f'<td class="rv"><span class="box"></span> موافق<br><span class="box"></span> يُعدّل<div class="ln"></div></td></tr>')

def table_start(): rows_html.append('<table><thead><tr><th>#</th><th>العربية</th><th>English</th><th>المراجعة</th></tr></thead><tbody>')
def table_end(): rows_html.append('</tbody></table>')

def verse_block(key, why):
    v = V[key]
    ref = f'{v["surah_name_ar"]} · {"، ".join(map(str, v["ayahs"]))}'
    rows_html.append(
        f'<div class="verse"><div class="vh"><b>{e(key)}</b> · {e(ref)} · <span>{e(why)}</span></div>'
        f'<div class="uth">{e(v["text_uthmani"])}</div>'
        f'<div class="ven">{e(v["translation_en"])} <i>(Saheeh International)</i></div>'
        f'<div class="vchk"><span class="box"></span> النص مطابق للمصحف &nbsp; <span class="box"></span> الآية مناسبة لموضعها &nbsp; <span class="box"></span> الترجمة مناسبة</div></div>')

def sources_line(keys):
    return f'<div class="src">المصادر: {" ، ".join(e(k) for k in keys)}</div>'

# ---------------- onboarding
o = S["onboarding"]
section("1. البداية", "أول ما يراه الزائر. المطلوب: وضوح العبارة وملاءمتها لغير المسلم.")
table_start()
for i, l in enumerate(o["intro_lines"]): row(f"سطر افتتاحي {i+1}", l)
row("سؤال النية", o["intent"]["prompt"])
row("ملاحظة الخصوصية", o["intent"]["note"])
for op in o["intent"]["options"]: row(f"خيار: {op['id']}", op["label"])
row("مقدمة الاختبار القبلي", o["pretest_intro"])
table_end()

# ---------------- dalil
d = S["dalil"]
section("2. الرفيق الذكي «دليل»", "تعريفه بنفسه، والعبارات الثابتة التي يقولها عند الامتناع والإحالة. أولوية عالية.")
table_start()
row("معنى الاسم", d["name_meaning"])
for i, l in enumerate(d["intro_lines"]): row(f"تعريف {i+1}", l, priority=True)
names = {"abstain_specialist": "امتناع وإحالة", "no_source": "غياب المصدر", "fatwa": "طلب فتوى", "respect": "الإساءة لدين",
         "cannot_alter_text": "طلب تغيير النص", "distress": "ضيق نفسي", "offline": "انقطاع الاتصال"}
for k, l in d["system"].items(): row(names.get(k, k), l, priority=True)
table_end()

# ---------------- horizon
h = S["horizon"]
section("3. الأفق (المحور)")
table_start()
for i, l in enumerate(h["lines"]): row(f"سطر {i+1}", l)
for g in h["gates"]: row(f"بوابة {g['world']}", g["question"])
table_end()

# ---------------- world 1
w = S["world1"]
section("4. العالم الأول: " + w["title"]["ar"], "يشمل كل محطة: النصوص، والآية كاملة، وأجوبة «دليل» المكتوبة مسبقاً. أجوبة دليل أولوية عالية.")
table_start(); row("العنوان", w["title"]); row("العنوان الفرعي", w["subtitle"]); table_end()
rows_html.append("<h3>الوصول</h3>")
verse_block(w["arrival"]["verse"], "آية الترحيب")
table_start()
for i, l in enumerate(w["arrival"]["after_lines"]): row(f"بعد الآية {i+1}", l, priority=True)
table_end()

for st in w["stations"]:
    rows_html.append(f'<h3>المحطة {st["number"]}: {e(st["title"]["ar"])} · {e(st["title"]["en"])}</h3>')
    table_start()
    row("مقدمة", st["intro"]); row("التعليمات", st["instruction"])
    for i, hh in enumerate(st.get("hints", [])): row(f"تلميح {i+1}", hh)
    if "chain" in st:
        row("حلقات السلسلة", {"ar": " ← ".join(c["ar"] for c in st["chain"]), "en": " ← ".join(c["en"] for c in st["chain"])})
        row("نهاية السلسلة", st["chain_end"])
    row("عند النجاح", st["success"]); row("الآية الكونية", st["sign"], priority=True)
    row("سؤال التأمل", st["reflection"], priority=True)
    table_end()
    verse_block(st["verse"], "الآية القرآنية للمحطة")
    if "answer_verse" in st:
        verse_block(st["answer_verse"]["verse"], st["answer_verse"]["heading"]["ar"])
    if "design_rule" in st:
        rows_html.append('<p class="rule">قاعدة تصميم: لا يُرمز إلى الله تعالى بأي شكل أو ضوء أو رمز؛ تُعرض آثار الخلق فقط (التعارض ثم الانسجام).</p>')
    rows_html.append('<h4>أسئلة مقترحة وأجوبة «دليل» المكتوبة مسبقاً</h4>')
    table_start()
    for s in st["dalil_suggestions"]:
        row(f"سؤال {s['id']}", s["question"])
        extra = sources_line(s["sources"]) + ('<div class="src">+ يعرض زر «تحدّث مع إنسان»</div>' if s["offer_human"] else "")
        row(f"جواب {s['id']}", s["answer"], priority=True, extra=extra)
    table_end()

ss = w["side_station"]
rows_html.append(f'<h3>محطة جانبية: {e(ss["title"]["ar"])}</h3>')
table_start(); row("مقدمة", ss["intro"]); row("الآية الكونية", ss["sign"]); row("سؤال التأمل", ss["reflection"], priority=True); table_end()
verse_block(ss["verse"], "آية المحطة الجانبية")

c = w["closing"]
rows_html.append("<h3>الختام</h3>")
table_start()
for i, l in enumerate(c["lines"]): row(f"سطر {i+1}", l, priority=True)
table_end()
verse_block(c["verse"], "آية الختام")
table_start(); row("بطاقة الجواب", c["answer_card"], priority=True); table_end()

# ---------------- checkpoint
cp = w["checkpoint"]
section("5. محطة الفهم (قبل الرحلة وبعدها)")
table_start()
row("مقدمة", cp["intro"])
for qq in Q["questions"]:
    if qq["type"] == "multiple_choice":
        opts_ar = " / ".join(("✔ " if op["id"] == qq["correct"] else "") + op["ar"] for op in qq["options"])
        opts_en = " / ".join(("✔ " if op["id"] == qq["correct"] else "") + op["en"] for op in qq["options"])
        row(f"{qq['id']} السؤال", qq["prompt"]); row(f"{qq['id']} الخيارات", {"ar": opts_ar, "en": opts_en}, priority=True)
    elif qq["type"] == "true_false":
        row(f"{qq['id']} السؤال", qq["prompt"]); row(f"{qq['id']} الإجابة", {"ar": "خطأ" if not qq["correct"] else "صح", "en": str(qq["correct"])})
    else:
        row(f"{qq['id']} السؤال", qq["prompt"])
        row(f"{qq['id']} الأزواج", {"ar": " ؛ ".join(f'{p["sign"]["ar"]} ← {p["verse"]}' for p in qq["pairs"]),
                                    "en": " ; ".join(f'{p["sign"]["en"]} → {p["verse"]}' for p in qq["pairs"])})
    row(f"{qq['id']} الشرح", cp["explanations"][qq["id"]], priority=True)
table_end()

# ---------------- ending
en = S["ending"]
section("6. الخاتمة", "لا يوجد أي ضغط أو دعوة مباشرة لاعتناق الإسلام؛ انطلاقاً من «لا إكراه في الدين».")
table_start()
for i, l in enumerate(en["lines"]): row(f"سطر {i+1}", l)
row("دفتر الآيات", en["journal"]["intro"]); row("السؤال", en["question"])
for op in en["options"]: row(f"خيار: {op['id']}", {"ar": op["label"]["ar"] + " — " + op["description"]["ar"], "en": op["label"]["en"] + " — " + op["description"]["en"]})
row("العبارة الختامية", en["tagline"])
table_end()
verse_block(en["verse_principle"], "المبدأ الحاكم للخاتمة")

n_items = counter["n"]
n_verses = len({k for k in (w["arrival"]["verse"], c["verse"], ss["verse"], en["verse_principle"],
                            *[st["verse"] for st in w["stations"]], "112:1-4")})

doc = f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فطرة · مراجعة المحتوى</title><style>
@font-face{{font-family:Plex;src:url({FONTS}/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-400-normal.woff2)}}
@font-face{{font-family:Plex;font-weight:700;src:url({FONTS}/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-700-normal.woff2)}}
@font-face{{font-family:Plex;src:url({FONTS}/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-400-normal.woff2);unicode-range:U+0000-00FF,U+2000-206F}}
@font-face{{font-family:Plex;font-weight:700;src:url({FONTS}/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-latin-700-normal.woff2);unicode-range:U+0000-00FF,U+2000-206F}}
@font-face{{font-family:AmiriQuran;src:url({FONTS}/@fontsource/amiri-quran/files/amiri-quran-arabic-400-normal.woff2)}}
@font-face{{font-family:Kufi;src:url({FONTS}/@fontsource/reem-kufi/files/reem-kufi-arabic-700-normal.woff2)}}
@page{{size:A4;margin:16mm 12mm 16mm 12mm}}
body{{font-family:Plex,sans-serif;color:#1b1f33;font-size:10.5pt;line-height:1.6}}
.cover{{height:250mm;display:flex;flex-direction:column;justify-content:center;page-break-after:always}}
.cover .logo{{font-family:Kufi;font-size:64pt;color:#b88a2c;line-height:1}}
.cover h1{{font-size:22pt;margin:12px 0 4px}} .cover p{{color:#555;max-width:150mm}}
.stats{{display:flex;gap:14px;margin:22px 0}} .stat{{border:1px solid #ddd;border-radius:10px;padding:10px 16px}} .stat b{{display:block;font-size:18pt;color:#1b1f33}}
.how{{background:#f6f3ea;border-radius:10px;padding:12px 16px;margin-top:10px}} .how li{{margin:2px 0}}
h2{{font-size:15pt;border-bottom:2px solid #b88a2c;padding-bottom:4px;margin:22px 0 6px;page-break-after:avoid}}
h3{{font-size:12pt;margin:16px 0 6px;color:#2b3b7a;page-break-after:avoid}} h4{{font-size:10.5pt;margin:12px 0 4px;page-break-after:avoid}}
.note{{color:#666;margin:0 0 8px;font-size:9.5pt}}
table{{width:100%;border-collapse:collapse;margin:4px 0 8px}} th{{background:#1b1f33;color:#fff;font-size:9pt;padding:5px 6px;text-align:right}}
td{{border-bottom:1px solid #e3e3e3;padding:6px;vertical-align:top}} tr{{page-break-inside:avoid}}
td.id{{width:12%;font-weight:700;color:#999;font-size:9pt}} .lbl{{font-weight:400;color:#555;font-size:8.5pt}}
td.ar{{width:38%}} td.en{{width:34%;direction:ltr;text-align:left;font-size:9.5pt;color:#333}} td.rv{{width:16%;font-size:8.5pt;color:#555}}
tr.prio td{{background:#fbf6e8}} tr.prio td.id{{color:#b88a2c}}
.box{{display:inline-block;width:9px;height:9px;border:1px solid #777;border-radius:2px;margin-left:3px;vertical-align:middle}}
.ln{{border-bottom:1px dotted #aaa;height:16px}}
.src{{font-size:8.5pt;color:#2b3b7a;margin-top:4px}}
.verse{{border:1px solid #e0d6b8;border-radius:10px;padding:10px 14px;margin:6px 0 10px;page-break-inside:avoid;background:#fffdf6}}
.vh{{font-size:9pt;color:#7a6320}} .vh span{{color:#999}}
.uth{{font-family:AmiriQuran;font-size:17pt;line-height:2.1;margin:4px 0}}
.ven{{direction:ltr;text-align:left;font-size:9.5pt;color:#444}} .ven i{{color:#999}}
.vchk{{font-size:8.5pt;color:#555;margin-top:6px}}
.rule{{background:#eef1fb;border-right:3px solid #2b3b7a;padding:6px 10px;font-size:9.5pt}}
</style></head><body>
<div class="cover"><div class="logo">فطرة</div><h1>مراجعة محتوى العالم الأول</h1>
<p>كل النصوص التي يراها الزائر في البداية والعالم الأول والخاتمة، مع الآيات كاملة وأجوبة «دليل» المكتوبة مسبقاً. نسخة 2 أكتوبر 2026.</p>
<div class="stats"><div class="stat"><b>{n_items}</b>عنصراً للمراجعة</div><div class="stat"><b>{n_verses}</b>مواضع آيات</div><div class="stat"><b>9</b>أجوبة لدليل</div></div>
<div class="how"><b>طريقة المراجعة</b><ol>
<li>لكل عنصر: ضع علامة «موافق» أو «يُعدّل» واكتب التعديل في السطر.</li>
<li>العناصر المظللة بالذهبي أولوية عالية: أجوبة دليل، والتعريفات، وبطاقات الجواب، وأسئلة التأمل.</li>
<li>لكل آية: تحقق من مطابقة النص للمصحف، ومناسبة الآية لموضعها، ومناسبة ترجمة المعنى.</li>
<li>النص القرآني مأخوذ من موسوعة القرآن الكريم (quranenc.com)، وترجمة المعاني الإنجليزية لصحيح إنترناشونال.</li>
</ol></div>
<p style="margin-top:30px">اسم المراجع: ............................................ &nbsp; التاريخ: ................ &nbsp; التوقيع: ................</p></div>
{''.join(rows_html)}
</body></html>"""

tmp = OUT.with_suffix(".html")
tmp.write_text(doc)
with sync_playwright() as pw:
    b = pw.chromium.launch(); p = b.new_page()
    p.goto(tmp.as_uri()); p.wait_for_timeout(600)
    p.pdf(path=str(OUT), format="A4", print_background=True, margin={"top": "16mm", "bottom": "16mm", "left": "12mm", "right": "12mm"},
          display_header_footer=True, header_template="<span></span>",
          footer_template='<div style="font-size:8px;color:#999;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>')
    b.close()
tmp.unlink()
print(f"{OUT} · {n_items} items")
