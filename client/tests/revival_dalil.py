import sys, time, json
from playwright.sync_api import sync_playwright
MOCKS = {
  'none': None,
  'good': "({answer:'The verse asks us to notice that we did not send the water down from the clouds.', type:'DALIL_EXPLANATION', citations:['56:68-70'], confidence:0.86})",
  'quote': "({answer:'أَفَرَأَيْتُمُ الْمَاءَ الَّذِي تَشْرَبُونَ', citations:['56:68-70'], confidence:0.9})",
  'badcite': "({answer:'Something plausible.', citations:['2:255'], confidence:0.9})",
  'deny': "(()=>{ throw {code:'not_granted', message:'no'} })()",
  'agency': "({answer:'You brought the rain to this valley.', type:'NARRATIVE_DIALOGUE', citations:[], confidence:0.95})",
}
mode = sys.argv[1]
with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 480, "height": 270})
    pg.on("pageerror", lambda e: print("PAGEERROR:", e))
    pg.on("console", lambda m: m.type == "error" and print("console error:", m.text[:300]))
    if MOCKS[mode]:
        pg.add_init_script("window.__calls=[]; window.claude = { use: async (n) => n==='sample' ? Object.freeze({ json: async (prompt, opts) => { window.__calls.push(prompt.length); await new Promise(r=>setTimeout(r,300)); return " + MOCKS[mode] + "; } }) : null };")
    pg.goto("http://localhost:8771/revival.html?q=low&nolag&speed=4")
    time.sleep(3)
    pg.locator(".start button").nth(1).click(force=True)
    time.sleep(2)
    pg.evaluate("window.revival.ff('stream')")
    pg.locator(".verse .continue.on").wait_for(timeout=200000)
    pg.locator(".verse .continue").click(force=True)
    time.sleep(6)
    # tap Dalil where it is on screen
    s = pg.evaluate("(()=>{const s=window.revival.dalil.screen(); return [s.x,s.y,s.visible]})()")
    print("dalil on screen:", s, "state", pg.evaluate("window.revival.dalil.state"))
    if s[2]:
        pg.mouse.click(s[0], s[1])
    else:
        pg.keyboard.press("/")
    time.sleep(1)
    print("ask open:", pg.evaluate("document.querySelector('.ask').classList.contains('on')"), "chips:", pg.evaluate("[...document.querySelectorAll('.ask .chip')].map(c=>c.textContent)"))
    pg.locator(".ask .chip").first.click(force=True)
    pg.locator(".caption.on").wait_for(timeout=60000)
    time.sleep(0.5)
    print("caption:", pg.evaluate("document.querySelector('.caption').innerText"), "| source:", pg.evaluate("document.querySelector('.caption').dataset.source"), "| type:", pg.evaluate("document.querySelector('.caption').dataset.type"))
    print("ai:", pg.evaluate("JSON.stringify(window.revival.dalil.aiStatus)"), "calls:", pg.evaluate("window.__calls || null"))
    b.close()
