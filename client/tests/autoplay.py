"""Autoplay the Fitrah build headlessly: clicks through every screen, solves the
stations through the debug hook, screenshots each new step and logs errors.
usage: python3 autoplay.py "<query>" <outdir> [max_seconds] [w h]"""
import sys, time, os
from playwright.sync_api import sync_playwright

q = sys.argv[1] if len(sys.argv) > 1 else "q=low"
out = sys.argv[2] if len(sys.argv) > 2 else "shots"
limit = float(sys.argv[3]) if len(sys.argv) > 3 else 400
W, H = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (1280, 720)
os.makedirs(out, exist_ok=True)

ACTIONS = [
    # (selector, label)
    (".intro .btn-gold", "lang"),
    (".sheet-center .options[role=radiogroup]:not(:has([aria-checked=true])) .option", "intent-opt"),
    (".sheet-center .row-end .btn-gold:not([disabled])", "sheet-continue"),
    (".sheet-center .options > .option:not([disabled])", "quiz-opt"),
    (".sheet-center .match-row:not(:has([aria-pressed=true])) .choices button", "match-row"),
    (".speech .btn:not([disabled])", "speech-next"),
    (".gate-label .btn-gold", "gate"),
    (".verse-card .btn-gold", "verse-collect"),
    (".verse-card .btn-ghost", "verse-close"),
    (".reflection .btn-gold", "reflect-go"),
    (".bottom-cta .btn", "cta"),
]

errors = []
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.on("console", lambda m: (print("console:", m.type, m.text[:300]), m.type == "error" and errors.append(m.text)))
    pg.on("pageerror", lambda e: (print("PAGEERROR:", e), errors.append(str(e))))
    pg.goto(f"http://localhost:8770/index.html?{q}")
    t0 = time.time(); last_step = None; n = 0; last_action = time.time(); idle_shot = 0
    matched_rows = set()
    while time.time() - t0 < limit:
        step = pg.evaluate("document.body.dataset.step || ''")
        if step != last_step:
            time.sleep(1.5)
            pg.screenshot(path=f"{out}/{n:02d}_{step}.png"); n += 1
            print(f"[{time.time()-t0:6.1f}s] step -> {step}")
            last_step = step
        if step == "ending":
            time.sleep(6)
            pg.screenshot(path=f"{out}/{n:02d}_ending_final.png"); n += 1
            break
        acted = False
        # stations with a puzzle: solve through the hook once its instruction shows
        if pg.evaluate("!!document.querySelector('.instruction') && typeof window.__fitrahSolve === 'function' && !document.querySelector('.bottom-cta')"):
            time.sleep(2)
            pg.screenshot(path=f"{out}/{n:02d}_{step}_puzzle.png"); n += 1
            pg.evaluate("window.__fitrahSolve(); window.__fitrahSolve = null;")
            print(f"[{time.time()-t0:6.1f}s] solved puzzle in {step}")
            acted = True
        if not acted:
            for sel, label in ACTIONS:
                loc = pg.locator(sel)
                if loc.count() and loc.first.is_visible():
                    try:
                        if label == "match":
                            # pick the correct verse per row: rows are sign -> verse
                            rows = pg.locator(".sheet-center .match-row")
                            for r in range(rows.count()):
                                if r in matched_rows: continue
                                rows.nth(r).locator("button").first.click(); matched_rows.add(r)
                                break
                        else:
                            if label in ("verse-collect", "reflect-go", "cta", "gate") or label.startswith("sheet"):
                                pg.screenshot(path=f"{out}/{n:02d}_{step}_{label}.png"); n += 1
                            loc.first.click(timeout=3000)
                        print(f"[{time.time()-t0:6.1f}s] {step}: {label}")
                        acted = True; last_action = time.time()
                    except Exception as e:
                        print("click failed", label, str(e)[:120])
                    break
        if not acted and time.time() - last_action > 20 and time.time() - idle_shot > 20:
            idle_shot = time.time()
            pg.screenshot(path=f"{out}/{n:02d}_{step}_idle.png"); n += 1
            print(f"[{time.time()-t0:6.1f}s] idle in {step}")
        time.sleep(0.9)
    print("ERRORS:", len(errors))
    for e in errors[:20]: print("  ", e[:300])
    b.close()
