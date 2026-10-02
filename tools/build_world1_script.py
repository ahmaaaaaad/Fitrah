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

def qa(qid, q_ar, q_en, a_ar, a_en, sources, refer=False, refs=None):
    return {"id": qid, "question": t(q_ar, q_en), "answer": t(a_ar, a_en),
            "sources": sources, "refs": refs or [], "offer_human": refer, "review_status": PENDING}

# Science references Dalil may show (each page was opened and checked, 2 October 2026)
REF = {
  "hoyle": {"label": t("عملية ألفا الثلاثية", "Triple-alpha process"), "url": "https://en.wikipedia.org/wiki/Triple-alpha_process"},
  "finetune": {"label": t("الضبط الدقيق للكون", "Fine-tuned universe"), "url": "https://en.wikipedia.org/wiki/Fine-tuned_universe"},
  "orbit": {"label": t("السرعة المدارية", "Orbital speed"), "url": "https://en.wikipedia.org/wiki/Orbital_speed"},
  "rayleigh": {"label": t("تشتت رايلي", "Rayleigh scattering"), "url": "https://en.wikipedia.org/wiki/Rayleigh_scattering"},
  "oec": {"label": t("مركّب إطلاق الأكسجين", "Oxygen-evolving complex"), "url": "https://en.wikipedia.org/wiki/Oxygen-evolving_complex"},
  "atp": {"label": t("جائزة نوبل للكيمياء ١٩٩٧", "Nobel Prize in Chemistry 1997"), "url": "https://www.nobelprize.org/prizes/chemistry/1997/press-release/"},
}

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
      "verse": "41:53",
      "after_lines": [
        t("في لغة القرآن، كلمة «آية» تعني الجملة من كلام الله، وتعني أيضاً العلامة.",
          "In the Qur'an's language, the word ayah means a verse, and it also means a sign."),
        t("رحلتك تبدأ من الآفاق: نجم، ثم كواكب، ثم ورقة شجر، ثم أنت.",
          "Your journey starts in the horizons: a star, then planets, then a leaf, then you."),
      ],
    },
    "stations": [
      {
        "id": "mizan",
        "number": 1,
        "title": t("الميزان", "The Balance"),
        "intro": t("نجم في آخر عمره. في قلبه تُصنع ذرات الكربون، مادة كل كائن حي.",
                   "A star near the end of its life. Its core makes carbon, the stuff of every living thing."),
        "instruction": t("أدِر الحلقة حول قلب النجم، ثم أعدها", "Turn the ring around the star's core, then bring it back"),
        "hints": [t("ادفع الحلقة بعيداً وراقب الكربون.", "Push the ring away and watch the carbon."),
                  t("للنافذة طرفان. جرّب الطرف الآخر.", "The window has two edges. Try the other one.")],
        "qadar": {
          "edge_line": t("خارج نافذة ضيقة لا يتكوّن كربون.", "Outside a narrow window, no carbon forms."),
          "return_line": t("أعد الحلقة إلى موضعها.", "Bring the ring back."),
          "measured": t("٧٫٦٥ ميغا إلكترون فولت · القيمة المقيسة", "7.65 MeV · the measured value"),
          "model_note": t("نموذج مبسّط للتوضيح؛ حدود النافذة من القياس.", "A simplified model; only the window's edges come from measurement."),
          "success": t("عاد الكربون. والنجم يزفر غباره لتُصنع منه الكواكب.",
                       "The carbon returns. The star breathes out the dust that planets are made from."),
          "sign": t("آية في الكون: كل شيء بقدر", "A sign in creation: everything in measure"),
          "verse": "54:49",
        },
        "orbits": {
          "intro": t("من غبار النجم وُلدت كواكب، لكنها بلا مدار.", "Planets formed from the star's dust, but none has an orbit yet."),
          "instruction": t("اسحب كوكباً إلى الخلف ثم أفلته", "Pull a planet back, then let go"),
          "fall": t("أبطأ مما ينبغي: سقط في النجم.", "Too slow: it fell into the star."),
          "escape": t("أسرع مما ينبغي: ضاع في البرد.", "Too fast: it drifted into the cold."),
          "wide": t("مداره بيضاوي جداً، يحرقه الحر ثم يجمّده البرد.", "Its orbit is too stretched: scorched, then frozen."),
          "locked": t("استقر في ميزانه.", "It settled into its balance."),
          "hints": [t("الخط المضيء يريك مساره قبل أن تُفلته.", "The glowing line shows its path before you let go."),
                    t("اجعل المسار دائرة تقريباً داخل حلقته.", "Make the path nearly a circle, inside its band.")],
        },
        "success": t("كل كوكب في ميزانه، فصار للنظام لحن واحد.", "Every planet in its balance, and the system sings one chord."),
        "sign": t("آية في الكون: الميزان", "A sign in creation: the balance"),
        "verse": "55:7-9",
        "reflection": t("لو كانت السرعة أقل قليلاً أو أكثر قليلاً، ماذا كان سيحدث؟ ومن وضع هذا الميزان؟",
                        "If the speed were a little less or a little more, what would happen? And who set this balance?"),
        "dalil_suggestions": [
          qa("mizan-1", "ما هو رنين هويل؟", "What is the Hoyle resonance?",
             "النجوم تصنع الكربون بدمج ثلاث نوى هيليوم عبر مستوى طاقة في الكربون قيمته نحو ٧٫٦٥ ميغا إلكترون فولت، تنبأ به الفلكي فريد هويل قبل أن يُقاس. ولو وقع هذا المستوى خارج نحو ٧٫٣ إلى ٧٫٩ لما صنعت النجوم كربوناً يكفي للحياة. والقرآن يقول: «إنا كل شيء خلقناه بقدر».",
             "Stars make carbon by fusing three helium nuclei through an energy level of carbon at about 7.65 MeV, which the astronomer Fred Hoyle predicted before it was measured. If that level fell outside about 7.3 to 7.9 MeV, stars would not make enough carbon for life. The Qur'an says: \"Indeed, all things We created with measure.\"",
             ["54:49"], refs=[REF["hoyle"]]),
          qa("mizan-2", "هل يعني هذا أن العلم يثبت وجود الله؟", "Does this mean science proves God?",
             "يسمّي القرآن ظواهر الكون «آيات»، أي علامات تدعو إلى التفكر ولا تُغني عنه. والعلماء يختلفون في تفسير هذا الضبط الدقيق. أما القرآن فيدعوك إلى النظر في الخلق والسؤال عمّن قدّره. وهذا حوار يستحق أن تكمله مع مختص.",
             "The Qur'an calls such things signs (ayat): they invite reflection, they don't replace it. Scientists disagree on how to explain this fine-tuning. The Qur'an invites you to look at creation and ask who set its measure. It's a conversation worth continuing with a specialist.",
             ["54:49", "3:190"], refer=True, refs=[REF["finetune"]]),
          qa("mizan-3", "لماذا يسقط الكوكب إذا كان بطيئاً؟", "Why does a slow planet fall?",
             "الجاذبية تشدّ الكوكب نحو النجم دائماً. فإذا كانت سرعته مناسبة ظلّ يسقط حول النجم لا فيه، وهذا هو المدار. وإن كان أبطأ سقط فيه، وإن تجاوز سرعة الإفلات، وهي أكبر من سرعة المدار الدائري بنحو ١٫٤ مرة، انطلق بعيداً ولم يعد.",
             "Gravity pulls the planet toward the star all the time. At the right speed it keeps falling around the star instead of into it: that's an orbit. Slower, it falls in. Above escape speed, about 1.4 times the circular speed, it flies off and never returns.",
             ["55:7-9"], refs=[REF["orbit"]]),
          qa("order-2", "ما معنى «آية»؟", "What does \"ayah\" mean?",
             "كلمة «آية» في القرآن تعني الجملة من كلام الله، وتعني أيضاً العلامة الدالة على شيء. ولهذا يسمّي القرآن ظواهر الكون آيات، كما في قوله إن في خلق السماوات والأرض واختلاف الليل والنهار آياتٍ لأولي الألباب.",
             "In the Qur'an, ayah means a verse of God's words, and it also means a sign that points to something. That is why the Qur'an calls natural phenomena ayat, as when it says the creation of the heavens and earth and the alternation of night and day hold signs for people of understanding.",
             ["3:190"]),
        ],
      },
      {
        "id": "sabab",
        "number": 2,
        "title": t("السبب", "The Cause"),
        "intro": t("هذا الكوكب حيّ. لكن من أين تأتي طاقة الحياة فيه؟", "This planet is alive. But where does its living energy come from?"),
        "instruction": t("اتبع الضوء إلى الداخل", "Follow the light inward"),
        "hints": [t("كل خطوة تفتح التي بعدها.", "Each step opens the next.")],
        "descent": {
          "sky": t("ضوء الشمس أبيض. والهواء يبعثر الأزرق أكثر من الأحمر بنحو ست مرات، فتصير السماء زرقاء.",
                   "Sunlight is white. Air scatters blue about six times more than red, so the sky turns blue."),
          "leaf": t("ورقة شجر. في كل خلية منها مصانع خضراء صغيرة.", "A leaf. Every cell in it holds small green factories."),
          "membrane": t("هنا يتحول الضوء إلى طاقة.", "Here, light becomes energy."),
        },
        "steps": [
          {"id": "tilt", "instruction": t("أدِر الورقة نحو الشمس", "Turn the leaf toward the sun"),
           "done": t("كلما واجهت الشمس أكثر، دخلها ضوء أكثر.", "The more it faces the sun, the more light comes in.")},
          {"id": "split", "instruction": t("اضغط مطولاً لتجمع الضوء", "Press and hold to gather light"),
           "done": t("أربعة فوتونات تشطر الماء: يخرج أكسجين، وتبقى الطاقة.", "Four photons split water: oxygen leaves, the energy stays.")},
          {"id": "guide", "instruction": t("قُد الإلكترون على طول السلسلة", "Lead the electron along the chain"),
           "done": t("كل قفزة تضخ البروتونات عبر الغشاء.", "Every hop pumps protons across the membrane.")},
          {"id": "rotor", "instruction": t("أدِر المحرك بالسرعة التي يسمح بها الضغط", "Turn the rotor at the pace the pressure allows"),
           "done": t("ثلاث جزيئات طاقة في كل دورة.", "Three energy molecules every turn.")},
        ],
        "climb": t("الطاقة في طعامك بدأت ضوءاً، والضوء من نجم، وكربون جسدك صُنع في نجم قبله.",
                   "The energy in your food began as light, the light came from a star, and your body's carbon was made in a star before it."),
        "chain_end": t("كل سبب يحتاج إلى سبب قبله. فهل تبدأ السلسلة من لا شيء؟", "Every cause needs one before it. Could the chain begin from nothing?"),
        "success": t("من الضوء إلى الطعام: كل حلقة تحتاج إلى ما قبلها.", "From light to food: every link needs the one before it."),
        "sign": t("آية في الكون: لكل شيء سبب", "A sign in creation: everything has a cause"),
        "verse": "52:35",
        "verse_food": "80:24-32",
        "reflection": t("هل يمكن لشيء أن يخلق نفسه؟ وهل يأتي شيء من لا شيء؟",
                        "Can anything create itself? Can something come from nothing?"),
        "dalil_suggestions": [
          qa("causes-1", "ماذا تعني آية «أم خُلقوا من غير شيء»؟", "What does \"Were they created by nothing?\" mean?",
             "الآية تسأل سؤالين: هل خُلق الناس من غير شيء؟ أم هم خلقوا أنفسهم؟ والعقل يرفض الاحتمالين، فيبقى أن لهم خالقاً.",
             "The verse asks two questions: were people created by nothing, or did they create themselves? Reason rejects both, which leaves the remaining answer: they have a Creator.",
             ["52:35"]),
          qa("sabab-atp", "ما هو محرك ATP؟", "What is ATP synthase?",
             "آلة جزيئية في أغشية الخلايا. تتدفق البروتونات عبرها فتدير دوّارها، وكل دورة كاملة تصنع ثلاث جزيئات ATP، عملة الطاقة في الخلية. والإنسان البالغ يستهلك ويجدد في يومه وهو مرتاح كمية من ATP تعادل نحو نصف وزن جسمه.",
             "A molecular machine in cell membranes. Protons flowing through it turn its rotor, and every full turn makes three ATP molecules, the cell's energy currency. At rest, an adult turns over about half their body weight in ATP each day.",
             [], refs=[REF["atp"]]),
          qa("sabab-sky", "لماذا السماء زرقاء؟", "Why is the sky blue?",
             "ضوء الشمس يحمل كل الألوان. وجزيئات الهواء تبعثر الأطوال الموجية القصيرة أكثر بكثير من الطويلة، إذ يتناسب التشتت عكسياً مع القوة الرابعة لطول الموجة. فيصلنا الأزرق من كل أنحاء السماء.",
             "Sunlight carries every colour. Air molecules scatter short wavelengths far more than long ones: scattering goes with one over the wavelength to the fourth power. So blue reaches us from every part of the sky.",
             [], refs=[REF["rayleigh"]]),
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
        "id": "fitrah",
        "number": 3,
        "title": t("الفطرة", "Fitrah"),
        "intro": t("والآن إلى الداخل. هذا نورك أنت.", "Now inward. This is your own light."),
        "instruction": t("اسحب كل حلقة حتى يتوقف التذبذب", "Drag each ring until the wavering stops"),
        "inner_tone": t("فيك نغمة كانت هنا منذ البداية.", "There is a tone in you that has been here from the start."),
        "layers": [t("السمع", "Hearing"), t("البصر", "Sight"), t("الفؤاد", "Heart")],
        "hints": [t("استمع: كلما اقتربت، أبطأ التذبذب.", "Listen: the closer you get, the slower the wavering.")],
        "second": {
          "appear": t("مصدر ثانٍ يدّعي أنه الأصل.", "A second source claims to be the origin."),
          "try": t("حاول أن تنسجم معهما معاً.", "Try to be in tune with both."),
          "fail": t("مع مصدرين مختلفين لا يستقر شيء.", "With two different sources, nothing settles."),
          "release": t("اترك المصدر الزائف", "Let the false source go"),
        },
        "success": t("مصدر واحد، فانسجم كل شيء.", "One source, and everything is in harmony."),
        "sign": t("آية في الكون وفي نفسك: الانسجام", "A sign in creation and in you: harmony"),
        "verse": "21:22",
        "answer_verse": {"verse": "112:1-4",
                         "heading": t("سورة الإخلاص: هكذا يصف القرآن الله", "Surat al-Ikhlas: how the Qur'an describes God")},
        "reflection": t("لو كان للكون أكثر من إله، هل سيبقى منسجماً؟",
                        "If the universe had more than one god, would it stay in harmony?"),
        "design_rule": "Never represent God with any shape, light, sound or symbol. The inner tone stands for the player's own nature; the game shows only effects: conflict, then harmony.",
        "dalil_suggestions": [
          qa("fitrah-1", "ما معنى الفطرة؟", "What does fitrah mean?",
             "الفطرة هي الطبيعة التي خُلق عليها كل إنسان. ويقول القرآن إنها الفطرة التي فطر الله الناس عليها، وإنه لا تبديل لخلق الله.",
             "Fitrah is the nature every person is created with. The Qur'an calls it the nature upon which God created people, and says there is no changing God's creation.",
             ["30:30"]),
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
        "w1-q3": t("ميزان السماء تتحدث عنه سورة الرحمن، وانسجام الكون تتحدث عنه سورة الأنبياء.",
                   "The balance of the heavens is in Surat ar-Rahman; the harmony of the universe is in Surat al-Anbiya."),
      },
      "result": t("شكراً لك. إجاباتك تساعدنا أن نعرف إن كانت الرحلة مفيدة.", "Thank you. Your answers help us know whether the journey helps."),
    },
  },

  # ------------------------------------------------------------------ interface labels (from the visual design)
  "ui": {
    "continue": t("متابعة", "Continue"),
    "next": t("التالي", "Next"),
    "go_on": t("تابع", "Continue"),
    "hint": t("تلميح", "Hint"),
    "drag_tooltip": t("اسحب إلى المدار المناسب", "Drag to the right orbit"),
    "reveal_verse": t("اكشف الآية", "Reveal the verse"),
    "reflect_label": t("تأمّل", "Reflect"),
    "journal_button": t("دفتر الآيات", "Journal of signs"),
    "verse_card": {
      "label": t("آية قرآنية", "A verse of the Qur'an"),
      "recitation": t("تلاوة", "Recitation"),
      "add_to_journal": t("أضف إلى دفتري", "Add to my journal"),
      "play_again": t("أعد التلاوة", "Play again"),
      "translation_label": t("ترجمة المعنى", "Translation of meaning"),
      "pause": t("إيقاف التلاوة مؤقتاً", "Pause recitation"),
    },
    "dalil_panel": {
      "tagline": t("يجيب من مصادر موثقة فقط", "Answers from trusted sources only"),
      "other_questions": t("أسئلة أخرى", "Other questions"),
      "read_verse": t("اقرأ الآية", "Read the verse"),
      "ask_another": t("سؤال آخر", "Ask something else"),
      "abstained_badge": t("لم يُجب · يحتاج إلى مختص", "Not answered · needs a specialist"),
      "voice": t("اسأل بصوتك", "Ask with your voice"),
      "send": t("إرسال", "Send"),
      "close": t("إغلاق", "Close"),
    },
    "checkpoint_progress": t("{n} من {total}", "{n} of {total}"),
    "closing_label": t("جواب العالم الأول", "World One's answer"),
    "sound_on": t("تشغيل الصوت", "Turn sound on"),
    "sound_off": t("كتم الصوت", "Mute sound"),
    "true_label": t("صح", "True"),
    "false_label": t("خطأ", "False"),
    "quiz_title_pre": t("قبل أن نبدأ", "Before we begin"),
    "quiz_title_post": t("محطة الفهم", "Understanding check"),
    "station_label": t("العالم الأول · المحطة {n}: {title}", "World One · Station {n}: {title}"),
    "oneness_drag": t("اسحب المستوى المائل للأسفل حتى ينطبق على الآخر", "Drag the tilted plane down until it lines up with the other"),
    "loading": t("يتشكّل الكون…", "The cosmos is forming…"),
    "restart": t("ابدأ الرحلة من جديد", "Start the journey again"),
    "score_line": t("قبل الرحلة: {pre} من {total} · بعدها: {post} من {total}", "Before the journey: {pre} of {total} · After: {post} of {total}"),
    "view_verse": t("اقرأ", "Read"),
    "assist_on": t("تشغيل وضع المساعدة", "Turn assist mode on"),
    "assist_off": t("إيقاف وضع المساعدة", "Turn assist mode off"),
    "assist_label": t("مساعدة", "Assist"),
    "keep_verse": t("احتفظ بالآية", "Keep this verse"),
    "pick_verse": t("اختر آية لتشاركها", "Pick a verse to share"),
    "human_form": {
      "lang_label": t("لغة المحادثة", "Conversation language"),
      "contact_label": t("وسيلة التواصل (بريد أو رقم)", "How to reach you (email or number)"),
      "message_label": t("ما الذي تودّ السؤال عنه؟ (اختياري)", "What would you like to ask about? (optional)"),
      "submit": t("أرسل الطلب", "Send request"),
      "saved": t("حُفظ طلبك على جهازك فقط، وسيُرسل إلى جهة شريكة عند اعتمادها. لا يُرسل شيء الآن.",
                 "Your request is saved on this device only. It will be sent once a partner center is confirmed; nothing is sent now."),
    },
    "learn": {
      "title": t("تابع التعلّم", "Keep learning"),
      "note": t("موسوعة القرآن الكريم المترجمة: ترجمات معتمدة لمعاني القرآن بأكثر من ستين لغة.",
                "The Noble Qur'an Encyclopedia: approved translations of the Qur'an's meanings in more than sixty languages."),
      "quranenc_label": t("افتح quranenc.com", "Open quranenc.com"),
    },
    "share": {
      "title": t("شارك آية", "Share a verse"),
      "save_hint": t("اضغط مطولاً على الصورة أو انقر بالزر الأيمن لحفظها.", "Long-press or right-click the image to save it."),
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
