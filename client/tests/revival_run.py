"""Scripted run against the Revival build.
usage: python3 rv.py <outdir> <W> <H> "<query>" cmd ...
cmds: wait:S shot:name click:sel eval:js waitfor:sel drag:x1,y1,x2,y2[,steps,dt] stats sweep:N (gather strokes toward screen centre-top)"""
import sys, time, os, json
from playwright.sync_api import sync_playwright
out, W, H, q = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
cmds = sys.argv[5:]
os.makedirs(out, exist_ok=True)
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": W, "height": H})
    errs = []
    def con(m):
        if m.type in ("error", "warning") and "GPU stall" not in m.text and "GL_CLOSE" not in m.text and "Automatic fallback" not in m.text:
            print("console:", m.type, m.text[:3000]); errs.append(m.text)
    pg.on("console", con)
    pg.on("pageerror", lambda e: (print("PAGEERROR:", e), errs.append(str(e))))
    pg.goto(f"http://localhost:8771/revival.html?{q}")
    t0 = time.time()
    def stats():
        s = pg.evaluate("JSON.stringify(window.revival.stats(), (k,v)=> typeof v==='number'? Math.round(v*100)/100 : v)")
        print(f"[{time.time()-t0:5.1f}] {s}")
    for c in cmds:
        k, _, v = c.partition(":")
        try:
            if k == "wait": time.sleep(float(v))
            elif k == "shot": pg.screenshot(path=f"{out}/{v}.png"); print(f"[{time.time()-t0:5.1f}] shot {v}")
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
                pg.mouse.move(x1, y1); pg.mouse.down()
                for i in range(1, steps + 1): pg.mouse.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); time.sleep(dt)
                pg.mouse.up(); print(f"[{time.time()-t0:5.1f}] drag {v}")
            elif k == "partat":
                # drag strokes around the screen projection of a world point "x,y,z,n"
                x, y, z, n = v.split(",")
                pt = pg.evaluate(f"(()=>{{const R=window.revival;const p=new R.camera.position.constructor({x},{y},{z});p.project(R.camera);return [(p.x*0.5+0.5)*innerWidth,(-p.y*0.5+0.5)*innerHeight]}})()")
                import math
                for i in range(int(n)):
                    a = i * 2.1
                    x1, y1 = pt[0] + math.cos(a) * W * 0.04, pt[1] + math.sin(a) * H * 0.04
                    x2, y2 = pt[0] + math.cos(a + 3.14) * W * 0.12, pt[1] + math.sin(a + 3.14) * H * 0.1
                    pg.mouse.move(x1, y1); pg.mouse.down()
                    for s in range(1, 7): pg.mouse.move(x1 + (x2 - x1) * s / 6, y1 + (y2 - y1) * s / 6); time.sleep(0.03)
                    pg.mouse.up()
                print(f"[{time.time()-t0:5.1f}] partat {pt} x{n}")
            elif k == "sweep":
                n = int(v)
                import math
                for i in range(n):
                    a = (i * 2.399) % (2 * math.pi)
                    cx, cy = W * 0.5, H * 0.32
                    x1, y1 = cx + math.cos(a) * W * 0.3, cy + math.sin(a) * H * 0.18
                    pg.mouse.move(x1, y1); pg.mouse.down()
                    for s in range(1, 7):
                        f = s / 6
                        pg.mouse.move(x1 + (cx - x1) * f, y1 + (cy - y1) * f); time.sleep(0.03)
                    pg.mouse.up(); time.sleep(0.05)
                print(f"[{time.time()-t0:5.1f}] sweep x{n}")
        except Exception as e:
            print("FAILED", c, str(e)[:300])
    print("errors:", len(errs))
    b.close()
