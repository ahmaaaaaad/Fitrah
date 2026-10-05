# Play-through tests

Headless Chromium (Playwright for Python) against a production build.

```
cd client && npx vite build && (cd dist && python3 -m http.server 8770 &)
python3 tests/autoplay.py "q=low&nolag" shots 600 1280 720   # first screen to ending, screenshots per step
python3 tests/dragtest.py drags                               # real pointer drags in stations 1 and 3
```

URL flags: `q=low` turns bloom off (software GPUs), `nolag` lets animations run in real time on slow frames,
`step=horizon|arrival|station1|station2|station3|closing|checkpoint|ending` jumps to a step, `lang=en` sets English for jumps.

## Fitrah: the menu, the four questions and The Water

```
cd client && npx vite build --config vite.fitrah.config.js
python3 -m http.server 8771 --directory dist-fitrah &
node tests/fitrah_validation.mjs                        # sources (hashes, hadith status), depths, device wordings, no Qur'anic wording in Dalil's lines
node tests/water_validation.mjs                         # Dalil's validation; every authored line and every device wording
cd tests
python3 fitrah_playthrough.py f_desk 1280 720           # menu -> Fitrah -> depth -> four questions -> chain (real drags) -> ... -> end card
MOBILE=1 python3 fitrah_playthrough.py f_port 390 844    # a phone in portrait, real touch events
AR=1 MOBILE=1 python3 fitrah_playthrough.py f_land 844 390   # landscape, in Arabic
./water_full_playthrough.sh full 960 540                # desktop: menu -> Tafakor -> The Water with real gestures -> end -> menu -> The Water
./water_full_playthrough.sh portrait 390 844 1          # emulated phone, real touch events
./water_full_playthrough.sh landscape 844 390 1
python3 water_dalil.py none|good|quote|badcite|deny|agency   # asking Dalil, with the artifact's model mocked
```

`fitrah_run.py` drives one run (commands are listed at its top). It prints every line Dalil speaks, the chain's
framing (`D.chainFrame`: authored / turned / widened, the lens, the safe region) and where the four points are on screen.
URL flags as above, plus `speed=4` to hurry the simulation and Dalil for review.
