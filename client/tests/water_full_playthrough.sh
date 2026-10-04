#!/bin/bash
# The Water, played through from the menu with real gestures, then back to the menu and in again.
# Serve client/dist-fitrah on :8771 first. Run from client/tests/.
# usage: ./water_full_playthrough.sh outdir W H [1 = touch phone]
#   desktop:          ./water_full_playthrough.sh full 960 540
#   phone portrait:   ./water_full_playthrough.sh portrait 390 844 1
#   phone landscape:  ./water_full_playthrough.sh landscape 844 390 1
OUT=$1; W=$2; H=$3; M=$4; TAP=click; [ "$M" = "1" ] && TAP=tap
CAP="eval:(document.querySelector('.caption.on .cap-text')||{}).textContent"
MOBILE=$M python3 -u fitrah_run.py $OUT $W $H "q=low&nolag&speed=4" wait:5 shot:00_menu "$TAP:.fm-ch.available" "until:window.fitrahLevel && window.fitrahLevel.director.D.started,90" wait:2 shot:01_arrival \
 "until:window.fitrahLevel.input.G.active && window.fitrahLevel.input.G.active.headScreen,60" wait:3 "$CAP" shot:02_current follow:240 shot:03_traced \
 "until:window.fitrahLevel.input.G.active && window.fitrahLevel.input.G.active.s.kind==='reveal',150" wait:3 "$CAP" shot:04_veil wipe:180 shot:05_revealed \
 "until:window.fitrahLevel.input.G.active && window.fitrahLevel.input.G.active.headScreen,260" wait:3 "$CAP" shot:06_water follow:320 shot:07_stream \
 "waitfor:.verse .w.on" wait:3 shot:08_verse1 "waitfor:.verse .layer.explain.on" shot:09_explain1 "waitfor:.verse .continue.on" "$TAP:.verse .continue" wait:5 shot:10_lead \
 "until:window.fitrahLevel.input.G.active && window.fitrahLevel.input.G.active.screens,260" wait:12 "$CAP" "eval:JSON.stringify(window.fitrahLevel.director.D.chainFrame).slice(0,200)" "eval:JSON.stringify(window.fitrahLevel.input.G.active.screens().map(p=>[Math.round(p.x),Math.round(p.y)]))" shot:11_chain connect:200 shot:12_linked \
 "until:window.fitrahLevel.input.G.active && window.fitrahLevel.input.G.active.targetScreen,160" wait:3 "$CAP" "eval:JSON.stringify(window.fitrahLevel.director.D.lightFrame)" shot:13_thin align:180 wait:4 shot:14_opening \
 "until:window.fitrahLevel.director.D.beat==='final',120" wait:2 shot:15_light "waitfor:.verse .w.on" wait:4 shot:16_verse2 "waitfor:.verse .layer.explain.on" shot:17_explain2 "waitfor:.verse .continue.on" "$TAP:.verse .continue" wait:3 shot:18_closing \
 "waitfor:.end.on" wait:2 shot:19_end "eval:window.fitrahLevel.bus.recent(40).map(e=>e.type).join(' ')" \
 "$TAP:.end [data-exit]" wait:1 shot:20_veil "until:window.fitrahShell && !window.fitrahLevel && document.querySelector('.fm.ready'),90" url wait:2 shot:21_menu_again \
 "$TAP:.fm-ch.available" "until:window.fitrahLevel && window.fitrahLevel.director.D.started,90" wait:4 shot:22_reopened stats url
