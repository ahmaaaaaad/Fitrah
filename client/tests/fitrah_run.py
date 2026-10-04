"""Scripted run against the Fitrah build (menu + levels), with real pointer or touch gestures.
Serve client/dist-fitrah first (python3 -m http.server 8771 --directory dist-fitrah), then from client/tests:
usage: python3 fitrah_run.py <outdir> <W> <H> "<query>[#hash]" cmd ...
  env MOBILE=1 emulates a touch phone (gestures become real touch events); env PORT overrides 8771
cmds: wait:S shot:name click:sel tap:sel eval:js waitfor:sel until:js,timeout stats url reload
      drag:x1,y1,x2,y2[,steps,dt]  follow:T (stay on a trace head)  wipe:T (look through the rain)
      connect:T (link the chain point to point)  align:T (hold on the thinning cloud)
cmds: wait:S shot:name click:sel eval:js waitfor:sel drag:x1,y1,x2,y2[,steps,dt] stats sweep:N (gather strokes toward screen centre-top)"""
import sys, time, os, json
from playwright.sync_api import sync_playwright
out, W, H, q = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
cmds = sys.argv[5:]
os.makedirs(out, exist_ok=True)
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    mobile = os.environ.get("MOBILE") == "1"
    ctxo = dict(viewport={"width": W, "height": H})
    if mobile: ctxo.update(has_touch=True, is_mobile=True, device_scale_factor=2, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
    bctx = b.new_context(**ctxo)
    pg = bctx.new_page()
    cdp = bctx.new_cdp_session(pg) if mobile else None
    # touch helpers (CDP), so the level sees real touch pointer events
    def tdown(x, y):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    def tmove(x, y):
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [{"x": x, "y": y, "id": 1}]})
    def tup():
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    class P:
        def move(self, x, y):
            (tmove(x, y) if (mobile and self.down_) else (None if mobile else pg.mouse.move(x, y)))
            if mobile and not self.down_: self.at = (x, y)
        def down(self):
            if mobile: self.down_ = True; tdown(*self.at)
            else: pg.mouse.down()
        def up(self):
            if mobile: self.down_ = False; tup()
            else: pg.mouse.up()
        down_ = False; at = (0, 0)
    ptr = P()
    errs = []
    # every line Dalil speaks is logged (caption text changes)
    pg.add_init_script("""addEventListener('DOMContentLoaded',()=>{const seen={v:''};setInterval(()=>{const c=document.querySelector('.caption.on .cap-text');const t=c?c.textContent:'';if(t&&t!==seen.v){seen.v=t;console.info('[cap] '+t)}},250)});""")
    def con(m):
        if m.text.startswith("[cap] "): print(f"  dalil: {m.text[6:]}"); return
        if m.type in ("error", "warning") and "GPU stall" not in m.text and "GL_CLOSE" not in m.text and "Automatic fallback" not in m.text:
            print("console:", m.type, m.text[:3000]); errs.append(m.text)
    pg.on("console", con)
    pg.on("pageerror", lambda e: (print("PAGEERROR:", e), errs.append(str(e))))
    qs, _, hs = q.partition("#")
    pg.goto(f"http://localhost:{os.environ.get('PORT', '8771')}/fitrah.html?{qs}" + (f"#{hs}" if hs else ""))
    t0 = time.time()
    def stats():
        s = pg.evaluate("JSON.stringify(window.fitrahLevel ? window.fitrahLevel.stats() : {shell: window.fitrahShell && window.fitrahShell.state}, (k,v)=> typeof v==='number'? Math.round(v*100)/100 : v)")
        print(f"[{time.time()-t0:5.1f}] {s}")
    for c in cmds:
        k, _, v = c.partition(":")
        try:
            if k == "wait": time.sleep(float(v))
            elif k == "shot": pg.screenshot(path=f"{out}/{v}.png"); print(f"[{time.time()-t0:5.1f}] shot {v}")
            elif k == "tap": pg.locator(v).first.tap(timeout=20000, force=True); print(f"[{time.time()-t0:5.1f}] tap {v}")
            elif k == "grab":
                import base64
                data = pg.evaluate("window.fitrahLevel.capture()")
                open(f"{out}/{v}.jpg", "wb").write(base64.b64decode(data.split(",", 1)[1])); print(f"[{time.time()-t0:5.1f}] grab {v}")
            elif k == "reload": pg.reload(); print(f"[{time.time()-t0:5.1f}] reload")
            elif k == "url": print(f"[{time.time()-t0:5.1f}] url", pg.url)
            elif k == "click": pg.locator(v).first.click(timeout=20000, force=True); print(f"[{time.time()-t0:5.1f}] click {v}")
            elif k == "waitfor": pg.locator(v).first.wait_for(state="visible", timeout=120000); print(f"[{time.time()-t0:5.1f}] saw {v}")
            elif k == "eval": print(f"[{time.time()-t0:5.1f}] eval ->", str(pg.evaluate(v))[:600])
            elif k == "stats": stats()
            elif k == "until":
                expr, _, tmo = v.rpartition(",")
                t1 = time.time(); ok = False
                while time.time() - t1 < float(tmo):
                    if pg.evaluate(expr): ok = True; break
                    time.sleep(1)
                print(f"[{time.time()-t0:5.1f}] until {expr[:60]} -> {ok} after {time.time()-t1:.0f}s"); stats()
            elif k == "drag":
                p = list(map(float, v.split(",")))
                x1, y1, x2, y2 = p[:4]; steps = int(p[4]) if len(p) > 4 else 20; dt = p[5] if len(p) > 5 else 0.03
                ptr.move(x1, y1); ptr.down()
                for i in range(1, steps + 1): ptr.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); time.sleep(dt)
                ptr.up(); print(f"[{time.time()-t0:5.1f}] drag {v}")
            elif k == "partat":
                # drag strokes around the screen projection of a world point "x,y,z,n"
                x, y, z, n = v.split(",")
                pt = pg.evaluate(f"(()=>{{const R=window.fitrahLevel;const p=new R.camera.position.constructor({x},{y},{z});p.project(R.camera);return [(p.x*0.5+0.5)*innerWidth,(-p.y*0.5+0.5)*innerHeight]}})()")
                import math
                for i in range(int(n)):
                    a = i * 2.1
                    x1, y1 = pt[0] + math.cos(a) * W * 0.04, pt[1] + math.sin(a) * H * 0.04
                    x2, y2 = pt[0] + math.cos(a + 3.14) * W * 0.12, pt[1] + math.sin(a + 3.14) * H * 0.1
                    ptr.move(x1, y1); ptr.down()
                    for s in range(1, 7): ptr.move(x1 + (x2 - x1) * s / 6, y1 + (y2 - y1) * s / 6); time.sleep(0.03)
                    ptr.up()
                print(f"[{time.time()-t0:5.1f}] partat {pt} x{n}")
            elif k == "follow":
                # press on the active trace's head and keep the pointer on it until it is done
                tmo = float(v or 120); t1 = time.time(); pressed = False
                while time.time() - t1 < tmo:
                    hp = pg.evaluate("(()=>{const g=window.fitrahLevel.input.G.active; if(!g||!g.headScreen||g.s.done) return null; const p=g.headScreen(); return [p.x,p.y,p.visible,g.s.u]})()")
                    if not hp: break
                    if not pressed: ptr.move(hp[0], hp[1]); ptr.down(); pressed = True
                    ptr.move(hp[0] + 6, hp[1] + 3); time.sleep(0.05)
                if pressed: ptr.up()
                print(f"[{time.time()-t0:5.1f}] follow done in {time.time()-t1:.0f}s")
            elif k == "wipe":
                tmo = float(v or 60); t1 = time.time()
                import math
                while time.time() - t1 < tmo:
                    act = pg.evaluate("(()=>{const g=window.fitrahLevel.input.G.active; return g && g.s && g.s.kind==='reveal' && !g.s.done})()")
                    if not act: break
                    y = H * (0.45 + 0.25 * math.sin(time.time()))
                    ptr.move(W * 0.25, y); ptr.down()
                    for i in range(1, 9): ptr.move(W * (0.25 + 0.5 * i / 8), y + math.sin(i) * 20); time.sleep(0.08)
                    time.sleep(0.4); ptr.up()
                print(f"[{time.time()-t0:5.1f}] wipe done in {time.time()-t1:.0f}s")
            elif k == "connect":
                tmo = float(v or 60); t1 = time.time()
                while time.time() - t1 < tmo:
                    st = pg.evaluate("(()=>{const g=window.fitrahLevel.input.G.active; if(!g||!g.screens||g.s.done) return null; return {l:g.s.linked, p:g.screens()}})()")
                    if not st: break
                    na = st['p'][st['l']]; nb = st['p'][st['l'] + 1]
                    ptr.move(na['x'], na['y']); ptr.down()
                    for i in range(1, 9): ptr.move(na['x'] + (nb['x'] - na['x']) * i / 8, na['y'] + (nb['y'] - na['y']) * i / 8); time.sleep(0.04)
                    time.sleep(0.2); ptr.up()
                print(f"[{time.time()-t0:5.1f}] connect done in {time.time()-t1:.0f}s")
            elif k == "align":
                tmo = float(v or 90); t1 = time.time(); pressed = False
                while time.time() - t1 < tmo:
                    tp = pg.evaluate("(()=>{const g=window.fitrahLevel.input.G.active; if(!g||!g.targetScreen||g.s.done) return null; const p=g.targetScreen(); return [p.x,p.y]})()")
                    if not tp: break
                    if not pressed: ptr.move(tp[0], tp[1]); ptr.down(); pressed = True
                    ptr.move(tp[0] + 10, tp[1] - 6); time.sleep(0.08)
                if pressed: ptr.up()
                print(f"[{time.time()-t0:5.1f}] align done in {time.time()-t1:.0f}s")
            elif k == "sweep":
                n = int(v)
                import math
                for i in range(n):
                    a = (i * 2.399) % (2 * math.pi)
                    cx, cy = W * 0.5, H * 0.32
                    x1, y1 = cx + math.cos(a) * W * 0.3, cy + math.sin(a) * H * 0.18
                    ptr.move(x1, y1); ptr.down()
                    for s in range(1, 7):
                        f = s / 6
                        ptr.move(x1 + (cx - x1) * f, y1 + (cy - y1) * f); time.sleep(0.03)
                    ptr.up(); time.sleep(0.05)
                print(f"[{time.time()-t0:5.1f}] sweep x{n}")
        except Exception as e:
            print("FAILED", c, str(e)[:300])
    print("errors:", len(errs))
    b.close()
