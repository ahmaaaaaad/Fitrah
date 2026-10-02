# Play-through tests

Headless Chromium (Playwright for Python) against a production build.

```
cd client && npx vite build && (cd dist && python3 -m http.server 8770 &)
python3 tests/autoplay.py "q=low&nolag" shots 600 1280 720   # first screen to ending, screenshots per step
python3 tests/dragtest.py drags                               # real pointer drags in stations 1 and 3
```

URL flags: `q=low` turns bloom off (software GPUs), `nolag` lets animations run in real time on slow frames,
`step=horizon|arrival|station1|station2|station3|closing|checkpoint|ending` jumps to a step, `lang=en` sets English for jumps.
