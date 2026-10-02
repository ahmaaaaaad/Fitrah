import json, re, unicodedata, hashlib, sys, pathlib
"""Regenerates data/quran/verses.json.
Usage: python3 tools/extract_verses.py <path to quran-json@3.1.2 dist folder>
Run from the repo root."""
SRC = pathlib.Path(sys.argv[1])
AR=json.load(open(SRC/'quran.json'))
EN=json.load(open(SRC/'quran_en.json'))
# (surah, ayah or range, usage, fragment as written in the design doc — checked below)
USES=[
 (3,[190],"world1.arrival","إِنَّ فِي خَلْقِ السَّمَاوَاتِ وَالْأَرْضِ وَاخْتِلَافِ اللَّيْلِ وَالنَّهَارِ لَآيَاتٍ لِّأُولِي الْأَلْبَابِ"),
 (67,[3],"world1.station1_order","مَّا تَرَىٰ فِي خَلْقِ الرَّحْمَٰنِ مِن تَفَاوُتٍ"),
 (52,[35],"world1.station2_causes","أَمْ خُلِقُوا مِنْ غَيْرِ شَيْءٍ أَمْ هُمُ الْخَالِقُونَ"),
 (21,[22],"world1.station3_oneness","لَوْ كَانَ فِيهِمَا آلِهَةٌ إِلَّا اللَّهُ لَفَسَدَتَا"),
 (112,[1,2,3,4],"world1.station3_oneness_answer",None),
 (51,[21],"world1.side_in_yourselves","وَفِي أَنفُسِكُمْ أَفَلَا تُبْصِرُونَ"),
 (30,[30],"world1.closing_fitrah","فِطْرَتَ اللَّهِ الَّتِي فَطَرَ النَّاسَ عَلَيْهَا"),
 (1,[2],"world1.checkpoint_q2","رَبِّ الْعَالَمِينَ"),
 (41,[53],"world1.frame_horizons_and_selves","سَنُرِيهِمْ آيَاتِنَا فِي الْآفَاقِ وَفِي أَنفُسِهِمْ"),
 (54,[49],"world1.mizan_qadar","إِنَّا كُلَّ شَيْءٍ خَلَقْنَاهُ بِقَدَرٍ"),
 (55,[7,8,9],"world1.mizan_orbits","وَالسَّمَاءَ رَفَعَهَا وَوَضَعَ الْمِيزَانَ"),
 (80,[24,25,26,27,28,29,30,31,32],"world1.sabab_food","فَلْيَنظُرِ الْإِنسَانُ إِلَىٰ طَعَامِهِ"),
 (23,[115],"world2.station1","أَفَحَسِبْتُمْ أَنَّمَا خَلَقْنَاكُمْ عَبَثًا"),
 (2,[30],"world2.station2","إِنِّي جَاعِلٌ فِي الْأَرْضِ خَلِيفَةً"),
 (45,[13],"world2.station2","وَسَخَّرَ لَكُم مَّا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ جَمِيعًا مِّنْهُ"),
 (67,[2],"world2.station3","الَّذِي خَلَقَ الْمَوْتَ وَالْحَيَاةَ لِيَبْلُوَكُمْ أَيُّكُمْ أَحْسَنُ عَمَلًا"),
 (51,[56],"world2.closing","وَمَا خَلَقْتُ الْجِنَّ وَالْإِنسَ إِلَّا لِيَعْبُدُونِ"),
 (6,[162],"world3.shahada","قُلْ إِنَّ صَلَاتِي وَنُسُكِي وَمَحْيَايَ وَمَمَاتِي لِلَّهِ رَبِّ الْعَالَمِينَ"),
 (4,[103],"world3.salah","إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَّوْقُوتًا"),
 (9,[103],"world3.zakah","خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ وَتُزَكِّيهِم بِهَا"),
 (2,[183],"world3.sawm","يَا أَيُّهَا الَّذِينَ آمَنُوا كُتِبَ عَلَيْكُمُ الصِّيَامُ كَمَا كُتِبَ عَلَى الَّذِينَ مِن قَبْلِكُمْ لَعَلَّكُمْ تَتَّقُونَ"),
 (49,[13],"world3.hajj","يَا أَيُّهَا النَّاسُ إِنَّا خَلَقْنَاكُم مِّن ذَكَرٍ وَأُنثَىٰ وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا"),
 (68,[4],"world3.akhlaq","وَإِنَّكَ لَعَلَىٰ خُلُقٍ عَظِيمٍ"),
 (2,[256],"ending.no_compulsion","لَا إِكْرَاهَ فِي الدِّينِ"),
 (3,[185],"world4.arrival","كُلُّ نَفْسٍ ذَائِقَةُ الْمَوْتِ"),
 (41,[39],"world4.station1","وَمِنْ آيَاتِهِ أَنَّكَ تَرَى الْأَرْضَ خَاشِعَةً فَإِذَا أَنزَلْنَا عَلَيْهَا الْمَاءَ اهْتَزَّتْ وَرَبَتْ إِنَّ الَّذِي أَحْيَاهَا لَمُحْيِي الْمَوْتَىٰ"),
 (36,[78,79],"world4.station2","قَالَ مَن يُحْيِي الْعِظَامَ وَهِيَ رَمِيمٌ قُلْ يُحْيِيهَا الَّذِي أَنشَأَهَا أَوَّلَ مَرَّةٍ"),
 (99,[7,8],"world4.station3","فَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ خَيْرًا يَرَهُ وَمَن يَعْمَلْ مِثْقَالَ ذَرَّةٍ شَرًّا يَرَهُ"),
 (39,[53],"world4.station4","قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ"),
 (57,[3],"world1.dalil_who_created_god","هُوَ الْأَوَّلُ وَالْآخِرُ"),
 (29,[46],"world1.dalil_same_god","وَإِلَٰهُنَا وَإِلَٰهُكُمْ وَاحِدٌ"),
 (6,[108],"dalil.rule_respect","وَلَا تَسُبُّوا الَّذِينَ يَدْعُونَ مِن دُونِ اللَّهِ"),
 (16,[125],"dalil.rule_wisdom","ادْعُ إِلَىٰ سَبِيلِ رَبِّكَ بِالْحِكْمَةِ وَالْمَوْعِظَةِ الْحَسَنَةِ"),
]
def skel(s):
    s=unicodedata.normalize('NFKD',s)
    s=s.replace('ٱ','ا').replace('ى','ي').replace('ة','ه').replace('ـ','')
    for a in 'أإآ': s=s.replace(a,'ا')
    s=s.replace('ؤ','و').replace('ئ','ي')
    out=''.join(ch for ch in s if 'ء'<=ch<='ي' and ch not in 'ءٔ')
    return out
def skel2(s):  # also drop alifs/waws/yaas that Uthmani spelling may omit or add
    return re.sub('[اويء]','',skel(s))
verses=[];report=[]
for su,ays,use,frag in USES:
    ch=AR[su-1]; en=EN[su-1]
    ar_text=' '.join(v['text'] for v in ch['verses'] if v['id'] in ays)
    en_text=' '.join(v['translation'] for v in en['verses'] if v['id'] in ays)
    ok = None if frag is None else (skel2(frag) in skel2(ar_text))
    report.append((su,ays,use,ok))
    verses.append({"key":f"{su}:{ays[0]}"+(f"-{ays[-1]}" if len(ays)>1 else ""),"surah":su,"surah_name_ar":ch['name'],"surah_name_en":en['transliteration'],
      "ayahs":ays,"ayah_texts":[{"n":v["id"],"ar":v["text"],"en":[e for e in en["verses"] if e["id"]==v["id"]][0]["translation"]} for v in ch["verses"] if v["id"] in ays],"text_uthmani":ar_text,"translation_en":en_text,"translation_en_author":"Saheeh International","used_in":use,
      "review_status":"pending_sharia_review"})
# merge duplicate keys (same verse used twice)
merged={}
for v in verses:
    if v['key'] in merged: merged[v['key']]['used_in'].append(v['used_in'])
    else: v['used_in']=[v['used_in']]; merged[v['key']]=v
out={"_meta":{"arabic_source":"Uthmani text, The Noble Qur'an Encyclopedia (quranenc.com), via npm quran-json@3.1.2",
  "english_source":"Saheeh International, via tanzil.net (npm quran-json@3.1.2)","license":"CC BY-SA 4.0 (quran-json); original texts per their publishers' terms",
  "rule":"Never edit text_uthmani or ayah_texts by hand. Regenerate from source. Display ayah by ayah (ayah_texts) with an end-of-ayah mark and number; show full verses or clearly marked portions."},
  "verses":list(merged.values())}
json.dump(out,open('data/quran/verses.json','w'),ensure_ascii=False,indent=2)
for r in report: print(r)
