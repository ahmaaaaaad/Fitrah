"""Real pointer tests: drag every planet onto its orbit (station 1) and drag the
tilted plane down (station 3), with no debug hooks."""
import sys, time, os
from playwright.sync_api import sync_playwright
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
W, H = 1280, 720
JS_TARGETS = """(i) => {
  const f = window.fitrah, cam = f.camera, p = f.cosmos.planets[i];
  const v = p.group.position.clone();
  const a = Math.atan2(v.z, v.x);
  const to = v.clone().set(p.R * Math.cos(a), 0, p.R * Math.sin(a));
  const s = (w) => { const q = w.clone().project(cam); return [(q.x * 0.5 + 0.5) * innerWidth, (-q.y * 0.5 + 0.5) * innerHeight]; };
  return [...s(v), ...s(to), p.mode];
}"""
def drag(pg, x1, y1, x2, y2, steps=12):
    pg.mouse.move(x1, y1); pg.mouse.down()
    for i in range(1, steps + 1):
        pg.mouse.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); time.sleep(0.04)
    time.sleep(0.6); pg.mouse.up()

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": W, "height": H})
    pg.on("pageerror", lambda e: print("PAGEERROR:", e))
    pg.goto("http://localhost:8770/index.html?q=low&nolag&step=station1")
    pg.locator(".instruction").wait_for(timeout=60000); time.sleep(2)
    for attempt in range(12):
        modes = pg.evaluate("window.fitrah.cosmos.planets.map(p => p.mode)")
        todo = [i for i, m in enumerate(modes) if m != "orbit"]
        if not todo: break
        i = todo[0]
        # freeze-ish: read and drag immediately
        x1, y1, x2, y2, mode = pg.evaluate(JS_TARGETS, i)
        drag(pg, x1, y1, x2, y2)
        time.sleep(1.2)
        print("planet", i, "->", pg.evaluate(f"window.fitrah.cosmos.planets[{i}].mode"))
    pg.screenshot(path=f"{out}/st1_after_drags.png")
    ok = pg.locator(".sign-pill").count() > 0 or pg.evaluate("document.querySelectorAll('.bottom-cta').length") > 0
    time.sleep(3); print("station1 solved by drag:", pg.locator(".sign-pill").count() > 0)
    pg.screenshot(path=f"{out}/st1_sign.png")

    pg.goto("http://localhost:8770/index.html?q=low&nolag&step=station3")
    pg.locator(".instruction").wait_for(timeout=60000); time.sleep(3)
    pg.screenshot(path=f"{out}/st3_before.png")
    for k in range(4):
        drag(pg, 640, 300, 640, 520, steps=16); time.sleep(1.5)
        if pg.locator(".instruction").count() == 0: break
    time.sleep(5)
    pg.screenshot(path=f"{out}/st3_after.png")
    print("station3 solved by drag:", pg.locator(".sign-pill").count() > 0 or pg.locator(".caption").count() > 0)
    b.close()
