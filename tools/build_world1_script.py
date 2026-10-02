#!/usr/bin/env python3
"""Builds data/content/world1_script.json — the World 1 content script.

Edit the text HERE, then run:  python3 tools/build_world1_script.py
Every Dalil answer must cite verse keys that exist in data/quran/verses.json.
"""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PENDING = "pending_sharia_review"

def t(ar, en):
    return {"ar": ar, "en": en}

def qa(qid, q_ar, q_en, a_ar, a_en, sources, refer=False):
    return {"id": qid, "question": t(q_ar, q_en), "answer": t(a_ar, a_en),
            "sources": sources, "offer_human": refer, "review_status": PENDING}

script = {
  "_meta": {
    "purpose": "All player-facing text for onboarding, the Horizon hub, World 1 and the short ending.",
    "status": "Draft — every item needs sharia review before release",
    "rules": [
      "Verse text and translations are never written here; they are referenced by key from data/quran/verses.json.",
      "Dalil answers here are the reviewed fallback answers for the suggested questions; live answers follow the same rules.",
      "No pressure, no conversion call-to-action, no judgement of people or other religions.",
    ],
  },

  # ------------------------------------------------------------------ onboarding
  "onboarding": {
    "intro_lines": [
      t("في داخل كل إنسان أسئلةٌ لا تهدأ.", "Inside every person are questions that never go quiet."),
      t("هذه رحلة للبحث عن أجوبتها.", "This is a journey to find their answers."),
    ],
    "language_prompt": t("اختر لغتك", "Choose your language"),
    "intent": {
      "prompt": t("ما الذي أتى بك؟", "What brings you here?"),
      "note": t("إجابتك تغيّر أسلوب الرحلة فقط، لا محتواها، ولا نحفظها باسمك.",
                "Your answer only changes the style of the journey, not its content, and it is never stored with your name."),
      "options": [
        {"id": "curious", "label": t("فضول لمعرفة الإسلام", "I'm curious about Islam"), "dalil_tone": "light"},
        {"id": "verify", "label": t("سمعتُ شيئاً عن الإسلام وأريد أن أتحقق", "I heard something about Islam and want to check it"), "dalil_tone": "direct"},
        {"id": "meaning", "label": t("أبحث عن معنى لحياتي", "I'm looking for meaning in my life"), "dalil_tone": "reflective"},
        {"id": "learner", "label": t("أنا مسلم جديد أو ما زلت أتعلّم", "I'm a new Muslim, or still learning"), "dalil_tone": "teaching"},
        {"id": "skip", "label": t("أفضّل ألا أقول", "I'd rather not say"), "dalil_tone": "light"},
      ],
    },
    "pretest_intro": t("قبل أن نبدأ: ثلاثة أسئلة سريعة. هذا ليس اختباراً لك، بل لنعرف إن كانت الرحلة تساعدك فعلاً.",
                       "Before we begin: three quick questions. This isn't a test of you; it tells us whether the journey actually helps."),
    "pretest_skip": t("تخطَّ", "Skip"),
  },

  # ------------------------------------------------------------------ Dalil
  "dalil": {
    "name": t("دليل", "Dalil"),
    "name_meaning": t("«دليل» تعني المرشد، وتعني البرهان أيضاً.", "\"Dalil\" means both a guide and a proof."),
    "intro_lines": [
      t("أهلاً بك. أنا دليل، رفيقك في هذه الرحلة.", "Welcome. I'm Dalil, your companion on this journey."),
      t("اسألني متى شئت، وسأجيبك من مصادر موثوقة فقط، وأريك المصدر دائماً.",
        "Ask me anything, anytime. I answer only from trusted sources, and I always show you the source."),
      t("لستُ عالماً ولا مفتياً. إن لم أجد جواباً موثوقاً، سأخبرك بصراحة وأدلّك على إنسان مختص.",
        "I'm not a scholar or a mufti. If I can't find a reliable answer, I'll tell you honestly and point you to a specialist."),
    ],
    "ask_button": t("اسأل دليل", "Ask Dalil"),
    "input_placeholder": t("اكتب سؤالك…", "Type your question…"),
    "source_label": t("المصدر", "Source"),
    "go_deeper": t("أريد التعمق", "Tell me more"),
    "talk_to_human": t("تحدّث مع إنسان", "Talk to a person"),
    "system": {
      "abstain_specialist": t("هذا سؤال يستحق جواباً من مختص، ولا أريد أن أجيبك بتخمين. هل تحب أن أوصلك بشخص يستطيع مساعدتك؟",
                              "That question deserves an answer from a specialist, and I don't want to guess. Would you like me to connect you with someone who can help?"),
      "no_source": t("لم أجد في مصادري المعتمدة جواباً موثوقاً عن هذا، ولذلك لن أجيب عنه. يستطيع مختص أن يساعدك.",
                     "I couldn't find a reliable answer to this in my approved sources, so I won't answer it. A specialist can help."),
      "fatwa": t("الأحكام الشخصية يجيب عنها أهل العلم بعد أن يسمعوا تفاصيل حالتك، وهذا ما لا أستطيعه. هل أوصلك بمختص؟",
                 "Personal religious rulings are given by scholars after they hear the details of your situation, which I can't do. Shall I connect you with a specialist?"),
      "respect": t("أحترم كل إنسان وكل دين، ولن أتحدث عن أحد بسوء. يسعدني أن أشرح لك ما يقوله الإسلام بمصادره.",
                   "I respect every person and every faith, and I won't speak badly of anyone. I'm happy to explain what Islam says, with its sources."),
      "cannot_alter_text": t("لا أغيّر نص القرآن ولا أكتب نصاً يشبهه. يمكنني أن أريك الآية كما هي مع ترجمة معناها.",
                             "I never alter the Qur'an's text or write anything imitating it. I can show you the verse exactly as it is, with a translation of its meaning."),
      "distress": t("يبدو أنك تمر بوقت صعب، ولستَ وحدك. إن كنت تفكر في إيذاء نفسك، تواصل الآن مع خدمات الطوارئ في بلدك أو مع شخص تثق به. وإن أحببت، أوصلك بإنسان تتحدث معه.",
                    "It sounds like you're going through something hard, and you're not alone. If you're thinking of hurting yourself, please contact your local emergency services or someone you trust right now. If you'd like, I can connect you with a person to talk to."),
      "offline": t("لا أستطيع الاتصال الآن، لكن هذه أجوبة لأسئلة شائعة راجعها مختصون.",
                   "I can't connect right now, but here are answers to common questions, reviewed by specialists."),
    },
  },

  # ------------------------------------------------------------------ hub
  "horizon": {
    "title": t("الأفق", "The Horizon"),
    "lines": [t("هنا تبدأ الرحلات، وإليه تعود.", "Every journey starts here, and returns here."),
              t("كل بوابة سؤال.", "Each gate is a question.")],
    "gates": [
      {"world": 1, "question": t("من خلقني؟", "Who created me?"), "state": "open"},
      {"world": 2, "question": t("لماذا أنا هنا؟", "Why am I here?"), "state": "coming_soon"},
      {"world": 3, "question": t("كيف أعيش؟", "How should I live?"), "state": "coming_soon"},
      {"world": 4, "question": t("ماذا بعد الموت؟", "What comes after death?"), "state": "coming_soon"},
    ],
    "coming_soon": t("قريباً", "Coming soon"),
    "enter": t("ادخل", "Enter"),
  },

  # ------------------------------------------------------------------ World 1
  "world1": {
    "title": t("من خلقني؟", "Who created me?"),
    "subtitle": t("العالم الأول · عالم الكون", "World One · The Cosmos"),
    "arrival": {
      "verse": "3:190",
      "after_lines": [
        t("في لغة القرآن، كلمة «آية» تعني الجملة من كلام الله، وتعني أيضاً العلامة.",
          "In the Qur'an's language, the word ayah means a verse, and it also means a sign."),
        t("في هذا العالم، كل علامة تكتشفها في الكون تفتح لك آية.",
          "In this world, every sign you discover in the cosmos opens a verse for you."),
      ],
    },
    "stations": [
      {
        "id": "order",
        "number": 1,
        "title": t("النظام", "Order"),
        "intro": t("الكواكب تائهة. مداراتها متداخلة، والنظام مفقود.", "The planets are lost. Their paths cross, and order is gone."),
        "instruction": t("اسحب كل كوكب إلى مداره", "Drag each planet onto its orbit"),
        "hints": [
          t("ابحث عن الحلقة الخافتة التي تناسب الكوكب.", "Look for the faint ring that fits the planet."),
          t("الكوكب الأقرب إلى الشمس يأخذ أصغر مدار.", "The planet closest to the sun takes the smallest orbit."),
        ],
        "success": t("عاد كل شيء إلى مكانه.", "Everything is back in its place."),
        "sign": t("آية في الكون: إحكام المدارات", "A sign in creation: precise orbits"),
        "verse": "67:3",
        "reflection": t("لو تغيّر مدار واحد قليلاً، ماذا يحدث؟ هل يأتي هذا الإحكام من الصدفة؟",
                        "If one orbit shifted slightly, what would happen? Could this precision come from chance?"),
        "dalil_suggestions": [
          qa("order-1", "هل يمكن أن يأتي هذا النظام صدفة؟", "Could this order come from chance?",
             "القرآن يدعوك إلى النظر في إحكام الخلق نفسه، ويقول إنك لن ترى فيه تفاوتاً، ثم يطلب منك أن تعيد النظر: هل ترى من خلل؟ ويقدّم هذا الإحكام آيةً تدل على الخالق.",
             "The Qur'an invites you to look at this very precision. It says you will see no inconsistency in creation, then asks you to look again: do you see any flaw? It presents this order as a sign pointing to the Creator.",
             ["67:3"]),
          qa("order-2", "ما معنى «آية»؟", "What does \"ayah\" mean?",
             "كلمة «آية» في القرآن تعني الجملة من كلام الله، وتعني أيضاً العلامة الدالة على شيء. ولهذا يسمّي القرآن ظواهر الكون آيات، كما في قوله إن في خلق السماوات والأرض واختلاف الليل والنهار آياتٍ لأولي الألباب.",
             "In the Qur'an, ayah means a verse of God's words, and it also means a sign that points to something. That is why the Qur'an calls natural phenomena ayat, as when it says the creation of the heavens and earth and the alternation of night and day hold signs for people of understanding.",
             ["3:190"]),
          qa("order-3", "لماذا يتحدث القرآن عن الكون كثيراً؟", "Why does the Qur'an talk about the universe so much?",
             "لأنه يخاطب عقل الإنسان، ويجعل التفكر في السماوات والأرض طريقاً إلى معرفة الخالق.",
             "Because it speaks to human reason, and makes reflecting on the heavens and the earth a path to knowing the Creator.",
             ["3:190", "67:3"]),
        ],
      },
      {
        "id": "causes",
        "number": 2,
        "title": t("من لا شيء؟", "From nothing?"),
        "intro": t("زهرة واحدة. لكن من أين جاءت؟", "A single flower. But where did it come from?"),
        "instruction": t("اضغط «من أين جاء؟» لتتبع السلسلة", "Tap \"Where did it come from?\" to follow the chain"),
        "chain_button": t("من أين جاء؟", "Where did it come from?"),
        "chain": [t("زهرة", "A flower"), t("بذرة", "A seed"), t("شجرة", "A tree"), t("مطر وتراب", "Rain and soil"),
                  t("شمس", "A sun"), t("نجوم", "Stars")],
        "chain_end": t("هل تستمر السلسلة إلى ما لا نهاية؟", "Does the chain go on forever?"),
        "hints": [t("استمر في السؤال عن الأصل.", "Keep asking where each thing came from.")],
        "success": t("لكل حلقة حلقةٌ قبلها… إلى أين تنتهي؟", "Every link has a link before it… where does it end?"),
        "sign": t("آية في الكون: كل ما يحدث له سبب", "A sign in creation: everything that comes to be has a cause"),
        "verse": "52:35",
        "reflection": t("هل يمكن لشيء أن يخلق نفسه؟ وهل يأتي شيء من لا شيء؟",
                        "Can anything create itself? Can something come from nothing?"),
        "dalil_suggestions": [
          qa("causes-1", "ماذا تعني آية «أم خُلقوا من غير شيء»؟", "What does \"Were they created by nothing?\" mean?",
             "الآية تسأل سؤالين: هل خُلق الناس من غير شيء؟ أم هم خلقوا أنفسهم؟ والعقل يرفض الاحتمالين، فيبقى أن لهم خالقاً.",
             "The verse asks two questions: were people created by nothing, or did they create themselves? Reason rejects both, which leaves the remaining answer: they have a Creator.",
             ["52:35"]),
          qa("causes-2", "إذا كان لكل شيء خالق، فمن خلق الله؟", "If everything has a creator, who created God?",
             "السؤال يفترض أن الخالق مخلوق مثلنا. والإسلام يعلّم أن الله لا يشبه مخلوقاته: لم يلد ولم يولد، وهو الأول. فسلسلة الأسباب تنتهي إليه، ولا تبدأ منه سلسلة جديدة.",
             "The question assumes the Creator is created like us. Islam teaches that God is unlike His creation: He neither begets nor was born, and He is the First. The chain of causes ends with Him; it does not start again from Him.",
             ["112:1-4", "57:3"], refer=True),
          qa("causes-3", "هل يتعارض هذا مع العلم؟", "Does this conflict with science?",
             "العلم يدرس كيف تعمل الأسباب في الكون، والآية تسأل عمّن أوجد الكون وأسبابه. وهذا سؤال كبير يستحق حواراً أطول مع مختص.",
             "Science studies how causes work within the universe; the verse asks who brought the universe and its causes into being. It's a big question that deserves a longer conversation with a specialist.",
             ["52:35"], refer=True),
        ],
      },
      {
        "id": "oneness",
        "number": 3,
        "title": t("الواحد", "The One"),
        "intro": t("قانونان يتنازعان المشهد: الشمس تُشدّ في اتجاهين، والليل والنهار يتصادمان.",
                   "Two laws fight over the scene: the sun is pulled two ways, and night and day collide."),
        "instruction": t("أزِل التعارض ليعود الانسجام", "Remove the conflict to restore harmony"),
        "hints": [t("مشهد واحد لا يحكمه قانونان متعارضان.", "One world cannot be run by two conflicting laws.")],
        "success": t("عاد الانسجام إلى كل شيء.", "Harmony returns to everything."),
        "sign": t("آية في الكون: انسجام الكون كله", "A sign in creation: the harmony of everything"),
        "verse": "21:22",
        "answer_verse": {"verse": "112:1-4",
                         "heading": t("سورة الإخلاص: هكذا يصف القرآن الله", "Surat al-Ikhlas: how the Qur'an describes God")},
        "reflection": t("لو كان للكون أكثر من إله، هل سيبقى منسجماً؟",
                        "If the universe had more than one god, would it stay in harmony?"),
        "design_rule": "Never represent God with any shape, light or symbol. Show only the effects: conflict, then harmony.",
        "dalil_suggestions": [
          qa("oneness-1", "هل يعني التوحيد أن الله لا يشبه شيئاً؟", "Does tawhid mean God is like nothing else?",
             "نعم. يقول القرآن عن الله: «ولم يكن له كفواً أحد»، أي لا مثيل له ولا نظير.",
             "Yes. The Qur'an says of God, \"Nor is there to Him any equivalent\": nothing is like Him.",
             ["112:1-4"]),
          qa("oneness-2", "ما معنى «الصمد»؟", "What does \"as-Samad\" mean?",
             "«الصمد» هو الذي تحتاج إليه المخلوقات كلها في حاجاتها، وهو لا يحتاج إلى أحد.",
             "As-Samad is the One every creature turns to in its needs, while He needs no one.",
             ["112:1-4"]),
          qa("oneness-3", "هل الله في الإسلام هو إله اليهود والنصارى؟", "Is God in Islam the God of Jews and Christians?",
             "يؤمن المسلمون بأن الله هو الذي أرسل الأنبياء جميعاً، ومنهم موسى وعيسى عليهما السلام. ويقول القرآن لأهل الكتاب: «وإلهنا وإلهكم واحد». ويختلف الإسلام مع غيره في بعض ما يُعتقد عن الله، كأن يكون له ولد.",
             "Muslims believe God is the One who sent all the prophets, including Moses and Jesus, peace be upon them. The Qur'an tells the People of the Scripture, \"Our God and your God is one.\" Islam differs with others on some beliefs about God, such as that He has a son.",
             ["29:46", "112:1-4"], refer=True),
        ],
      },
    ],
    "side_station": {
      "id": "within",
      "title": t("في نفسك", "Within yourself"),
      "intro": t("استمع… هذا نبض قلبك.", "Listen… that's your heartbeat."),
      "sign": t("آية في نفسك: الجسد الإنساني", "A sign within you: the human body"),
      "verse": "51:21",
      "reflection": t("من يُبقي قلبك نابضاً وأنت نائم؟", "Who keeps your heart beating while you sleep?"),
    },
    "closing": {
      "lines": [t("الفطرة: الطبيعة التي خُلق عليها كل إنسان.", "Fitrah: the nature every person is created with.")],
      "verse": "30:30",
      "answer_card": t("لك خالق واحد، لا شريك له ولا يشبهه شيء، وتعرفه فطرتك التي فُطرت عليها.",
                       "You have one Creator, with no partner and nothing like Him, and the nature you were created with recognizes Him."),
    },
    "checkpoint": {
      "quiz": "data/content/world1_quiz.json",
      "intro": t("قبل أن تعود إلى الأفق: نفس الأسئلة الثلاثة من البداية.", "Before you return to the Horizon: the same three questions from the start."),
      "correct": [t("أحسنت.", "Well done."), t("تماماً.", "Exactly."), t("صحيح.", "That's right.")],
      "retry": t("لنعد إلى تلك اللحظة مرة أخرى.", "Let's revisit that moment."),
      "explanations": {
        "w1-q1": t("التوحيد أن الله واحد، لا شريك له ولا يشبهه شيء، كما في سورة الإخلاص.",
                   "Tawhid means God is One, with no partner and nothing like Him, as in Surat al-Ikhlas."),
        "w1-q2": t("خطأ. الله في القرآن «رب العالمين»: رب الناس جميعاً وكل المخلوقات.",
                   "False. In the Qur'an, God is \"Lord of the worlds\": Lord of all people and all creation."),
        "w1-q3": t("إحكام المدارات تتحدث عنه سورة الملك، وانسجام الكون تتحدث عنه سورة الأنبياء.",
                   "The precision of the orbits is in Surat al-Mulk; the harmony of the universe is in Surat al-Anbiya."),
      },
      "result": t("شكراً لك. إجاباتك تساعدنا أن نعرف إن كانت الرحلة مفيدة.", "Thank you. Your answers help us know whether the journey helps."),
    },
  },

  # ------------------------------------------------------------------ ending (challenge version)
  "ending": {
    "lines": [t("حملتَ أول نور.", "You've carried the first light.")],
    "journal": {
      "title": t("دفتر الآيات", "Journal of signs"),
      "intro": t("كل آية هنا اكتشفتها بنفسك.", "You discovered every verse here yourself."),
      "empty": t("لم تكتشف آيات بعد.", "No verses discovered yet."),
      "download": t("حمّل دفترك", "Download your journal"),
    },
    "question": t("هل تريد أن تعرف أكثر؟", "Would you like to know more?"),
    "options": [
      {"id": "human", "label": t("تحدّث مع إنسان", "Talk to a person"),
       "description": t("مختص من مركز للتعريف بالإسلام، بلغتك.", "A specialist from an Islamic information center, in your language.")},
      {"id": "learn", "label": t("تابع التعلّم", "Keep learning"),
       "description": t("مصادر مختارة وموثوقة بلغتك.", "Selected, trusted resources in your language.")},
      {"id": "share", "label": t("شارك آية", "Share a verse"),
       "description": t("اختر آية من دفترك وشاركها.", "Pick a verse from your journal and share it.")},
    ],
    "human_form_note": t("نسخة تجريبية: سيُرسل طلبك إلى جهة شريكة عند اعتمادها.", "Pilot version: your request will go to a partner center once one is confirmed."),
    "verse_principle": "2:256",
    "tagline": t("لأن كل إنسان يحمل الأسئلة نفسها.", "Because every person carries the same questions."),
  },
}

# ------------------------------------------------------------------ validation
verses = {v["key"] for v in json.loads((ROOT / "data/quran/verses.json").read_text())["verses"]}
used = []
def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ("verse", "verse_principle") and isinstance(v, str): used.append(v)
            elif k == "sources": used.extend(v)
            else: walk(v)
    elif isinstance(o, list):
        for x in o: walk(x)
walk(script)
missing = sorted(set(used) - verses)
assert not missing, f"verse keys not in verses.json: {missing}"

out = ROOT / "data/content/world1_script.json"
out.write_text(json.dumps(script, ensure_ascii=False, indent=2) + "\n")
print(f"wrote {out.relative_to(ROOT)} · {len(set(used))} verse keys, all present")
