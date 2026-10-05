"""Play the Fitrah level (the four questions) from the menu to its end card, with real gestures.
Serve client/dist-fitrah first (python3 -m http.server 8771 --directory dist-fitrah), then from client/tests:
  python3 fitrah_playthrough.py <outdir> <W> <H> [query] [maxSeconds]
  env MOBILE=1  a touch phone (the chain is dragged with real touch events)
  env AR=1      switch the menu to Arabic first
  env ENDAT=ch1-answer  stop when that beat begins
  env PORT      overrides 8771
Prints every line Dalil says (with its content-type label), each beat, each link of the chain; a screenshot per beat."""
import sys, time, os, json, base64
from playwright.sync_api import sync_playwright
out, W, H = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
q = sys.argv[4] if len(sys.argv) > 4 else "q=low&nolag&speed=3"
maxs = float(sys.argv[5]) if len(sys.argv) > 5 else 560
endat = os.environ.get("ENDAT")
os.makedirs(out, exist_ok=True)
mobile = os.environ.get("MOBILE") == "1"
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    o = dict(viewport={"width": W, "height": H})
    if mobile: o.update(has_touch=True, is_mobile=True, device_scale_factor=2, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
    ctx = b.new_context(**o); pg = ctx.new_page()
    cdp = ctx.new_cdp_session(pg) if mobile else None
    errs = []
    pg.add_init_script("""addEventListener('DOMContentLoaded',()=>{const seen={v:''};setInterval(()=>{const c=document.querySelector('.caption.on');const t=c?((c.querySelector('.cap-label').textContent?'['+c.querySelector('.cap-label').textContent+'] ':'')+c.querySelector('.cap-text').textContent):'';if(t&&t!==seen.v){seen.v=t;console.info('[cap] '+t)}},200)});""")
    t0 = time.time()
    T = lambda: f"[{time.time()-t0:5.1f}]"
    def con(m):
        if m.text.startswith("[cap] "): print(f"{T()}   dalil: {m.text[6:]}"); return
        if m.type in ("error", "warning") and "GPU stall" not in m.text and "GL_CLOSE" not in m.text and "Automatic fallback" not in m.text:
            print("console:", m.type, m.text[:2000]); errs.append(m.text)
    pg.on("console", con)
    pg.on("pageerror", lambda e: (print("PAGEERROR:", e), errs.append(str(e))))
    pg.goto(f"http://localhost:{os.environ.get('PORT', '8771')}/fitrah.html?{q}")
    def shot(n): pg.screenshot(path=f"{out}/{n}.png"); print(f"{T()} shot {n}")
    def tap(sel):
        loc = pg.locator(sel).first
        if mobile: loc.tap(timeout=15000, force=True)
        else: loc.click(timeout=15000, force=True)
    def visible(sel): return pg.evaluate(f"(()=>{{const e=document.querySelector({json.dumps(sel)});if(!e)return false;const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&s.visibility!=='hidden'&&+s.opacity>0.5}})()")
    def drag(x1, y1, x2, y2, steps=24, dt=0.04):
        if mobile:
            cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x1, "y": y1, "id": 1}]})
            for i in range(1, steps + 1): cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x1 + (x2 - x1) * i / steps, "y": y1 + (y2 - y1) * i / steps, "id": 1}]}); time.sleep(dt)
            cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        else:
            pg.mouse.move(x1, y1); pg.mouse.down()
            for i in range(1, steps + 1): pg.mouse.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); time.sleep(dt)
            pg.mouse.up()
    time.sleep(5)
    if os.environ.get("AR") == "1": tap('.fm-lang'); time.sleep(1.5); print(T(), "menu in Arabic")
    shot("00_menu")
    tap('.fm-ch[data-id="fitrah"]'); print(T(), "chose Fitrah")
    while not pg.evaluate("!!(window.fitrahLevel && window.fitrahLevel.director.D.started)"):
        time.sleep(1)
        if time.time() - t0 > 90: print("never started"); break
    last_step = None; shots = 0; linkshots = 0; done = False; last_link = -1; verse_n = 0
    while time.time() - t0 < maxs:
        s = pg.evaluate("window.fitrahLevel.stats()")
        if s["step"] != last_step:
            print(f"{T()} STEP {s['step']}  {json.dumps({k: s[k] for k in ('depth','state','shot','dalil')})}")
            last_step = s["step"]; time.sleep(2.5); shots += 1; shot(f"{shots:02d}_{s['step']}")
            if endat and s["step"] == endat: break
            continue
        if visible(".depth.on"):
            time.sleep(1.5); shots += 1; shot(f"{shots:02d}_depth"); tap('.depth [data-depth="learning"]'); print(T(), "depth: learning"); time.sleep(1); continue
        if visible(".verse .continue.on"):
            verse_n += 1; shots += 1; shot(f"{shots:02d}_source{verse_n}")
            tap(".verse .continue.on"); print(T(), "continue (source)"); time.sleep(1.5); continue
        if visible(".next.on"):
            shots += 1; shot(f"{shots:02d}_next_{s['step']}")
            tap(".next.on"); print(T(), "next"); time.sleep(1.5); continue
        if s.get("linked") is not None and not pg.evaluate("window.fitrahLevel.director.chain.s.done") and pg.evaluate("window.fitrahLevel.director.chain.s.active"):
            sc = pg.evaluate("window.fitrahLevel.chainScreens()")
            k = s["linked"]
            nxt = pg.evaluate(f"window.fitrahLevel.director.chain.nodes[{k+1}].shownT")
            if nxt > 0.6 and sc[k]["visible"] and sc[k + 1]["visible"]:
                if k == 0 and linkshots == 0: time.sleep(2); shots += 1; shot(f"{shots:02d}_chain_start"); linkshots = 1
                a, c = sc[k], sc[k + 1]
                drag(a["x"], a["y"], c["x"], c["y"])
                time.sleep(1.2)
                k2 = pg.evaluate("window.fitrahLevel.director.chain.s.linked")
                print(f"{T()} drag {k}->{k+1} ({a['x']:.0f},{a['y']:.0f})->({c['x']:.0f},{c['y']:.0f}) linked={k2}")
                if k2 in (3, 6): time.sleep(2); shots += 1; shot(f"{shots:02d}_chain_{k2}")
            else:
                time.sleep(0.5)
            continue
        if visible(".end.on"):
            time.sleep(2); shots += 1; shot(f"{shots:02d}_end"); done = True; break
        time.sleep(0.5)
    print(T(), "finished" if done else "stopped", json.dumps(pg.evaluate("window.fitrahLevel.stats()")))
    print("ERRORS:", len(errs))
    b.close()
