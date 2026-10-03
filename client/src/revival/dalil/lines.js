// Dalil's authored lines for the prototype slice. Short, humble, never a quoted
// verse. Status: authored for the prototype, pending content and Sharia review.
export const REVIEW_STATUS = 'prototype-authored, pending review';

// P3 environmental commentary: at most four of these play in the slice.
export const COMMENT = {
  firstCloud: { en: 'The air gathers where you sweep it.', ar: 'يجتمع الهواء حيث تسوقه.' },
  ripening: { en: 'We can gather the air. Sending the rain is not ours.', ar: 'نستطيع أن نسوق الهواء… أمّا إنزال المطر فليس إلينا.' },
  firstGrass: { en: 'Look. Green, where there was only dust.', ar: 'انظر… خُضرةٌ حيث لم يكن إلا الغبار.' },
  stream: { en: 'The water is finding its way.', ar: 'الماء يشقّ طريقه.' },
  flowers: { en: 'Even the colour has come back.', ar: 'حتى الألوان عادت.' },
};

// P3 contextual guidance after a stall (25 s without progress). One observation at most.
export const GUIDE = {
  gather: { en: 'Try sweeping the air toward one place, gently.', ar: 'جرّب أن تسوق الهواء نحو موضعٍ واحد… برفق.' },
  scatter: { en: 'Gently. Too fast, and the clouds tear apart.', ar: 'برفق… السرعة تمزّق السحاب.' },
  wait: { en: 'It is growing heavy. Wait with it.', ar: 'إنه يثقل… انتظر معه.' },
  dim: { en: 'The light is above the clouds. Draw them apart, a little.', ar: 'النور فوق السحاب… افرُقه قليلًا.' },
  bright: { en: 'Too much. The flowers are thirsty; let some cloud return.', ar: 'أكثر من اللازم… الزهر يعطش، دع بعض السحاب يعود.' },
  walk: { en: 'Walk on when you are ready.', ar: 'امضِ حين تكون مستعدًّا.' },
};

// P1 reflections, one after each revelation, never over the text.
export const REFLECT = {
  water: { en: 'We moved the air. The water came down when it was sent.', ar: 'نحن حرّكنا الهواء… والماء نزل حين أُنزِل.' },
  final: { en: 'The light was always there. We only cleared the way to it.', ar: 'النور كان هنا دائمًا… كلّ ما فعلناه أنّا أزحنا ما يحجبه.' },
};

// Reviewed answers, matched by intent (fallback level 1). Citations use verse keys only.
export const ANSWERS = {
  why_no_rain: {
    keys: ['rain', 'why not', 'yet', 'wait', 'مطر', 'لماذا لا', 'لم ينزل', 'متى'],
    en: 'A cloud has to gather and grow heavy first. We can move the air; sending the rain down is not ours.',
    ar: 'لا بدّ أن يجتمع السحاب ويثقل أولًا. نحن نسوق الهواء، أمّا إنزال المطر فليس إلينا.',
    cite: [],
  },
  what_to_do: {
    keys: ['what do', 'how', 'help', 'stuck', 'ماذا أفعل', 'كيف', 'ساعد'],
    en: 'Sweep across the sky toward one place, gently, then wait. Later, draw the clouds apart to let some light in.',
    ar: 'اسحب عبر السماء نحو موضعٍ واحد برفق، ثم انتظر. وبعد ذلك افرُق السحاب ليدخل شيء من النور.',
    cite: [],
  },
  water_verse: {
    keys: ['water', 'verse', 'mean', 'drink', 'clouds', 'الماء', 'الآية', 'معنى', 'تشربون'],
    en: 'It asks us to look at the water we drink: we did not bring it down from the clouds. The fitting answer is gratitude.',
    ar: 'تدعونا إلى التأمّل في الماء الذي نشربه: لسنا نحن من أنزله من المزن. والجواب اللائق هو الشكر.',
    cite: ['56:68-70'],
  },
  grateful: {
    keys: ['grateful', 'thank', 'bitter', 'شكر', 'تشكرون', 'أجاج'],
    en: 'The water is a gift we could not have made, and it could have been bitter. The verse ends by asking why we are not grateful.',
    ar: 'الماء نعمةٌ لم نصنعها، وكان يمكن أن يكون مُرًّا لا يُشرب. وتختم الآية بسؤالنا عن الشكر.',
    cite: ['56:68-70'],
  },
  revival_verse: {
    keys: ['life', 'earth', 'dead', 'revive', 'final', 'light', 'الأرض', 'يحيي', 'موتها', 'الحياة'],
    en: 'It says Allah gives life to the earth after its lifelessness, and that the signs are made clear so we might understand. The meadow is one such sign.',
    ar: 'تقول إن الله يُعيد الحياة إلى الأرض بعد أن كانت هامدة، وإنه بيّن الآيات لعلّنا نفهم. وهذا المرج علامةٌ من تلك العلامات.',
    cite: ['57:17', '41:39'],
  },
  balance: {
    keys: ['all the clouds', 'open', 'too much', 'balance', 'sun', 'كل السحاب', 'توازن', 'الشمس'],
    en: 'Too much sun dries the meadow; too little keeps it dim. It lives in the measure between.',
    ar: 'كثرة الشمس تُيبس المرج، وقلّتها تُبقيه معتمًا. حياته في الميزان بينهما.',
    cite: [],
  },
  fitrah: {
    keys: ['fitrah', 'fitra', 'nature', 'name', 'فطرة', 'الفطرة'],
    en: 'Fitrah is the original nature people are created with. The project takes its name from it.',
    ar: 'الفطرة هي الطبيعة الأولى التي خُلق عليها الإنسان، ومنها أخذ المشروع اسمه.',
    cite: ['30:30'],
  },
  provisional: {
    keys: ['provisional', 'review', 'why this verse', 'alternative', 'مؤقت', 'مراجعة', 'بديل'],
    en: 'The final verse is a provisional choice. It needs verification and Sharia review before it is final; 30:50 is the alternative.',
    ar: 'اختيار الآية الأخيرة مؤقّت، ويحتاج إلى تحقّق ومراجعة شرعية قبل اعتماده؛ والآية ٣٠:٥٠ هي البديل.',
    cite: ['57:17', '30:50'],
  },
  who_are_you: {
    keys: ['who are you', 'dalil', 'your name', 'من أنت', 'دليل'],
    en: 'I am Dalil, a small light walking with you. I share only what I have a source for.',
    ar: 'أنا دليل، نورٌ صغير يمشي معك. لا أقول إلا ما لديّ مصدرٌ له.',
    cite: [],
  },
};
export const UNKNOWN = { en: "I don't have a reliable source for that.", ar: 'ليس لديّ مصدرٌ موثوق لذلك.' };

// Two or three questions offered in the ask ribbon, by phase.
export const SUGGEST = {
  start: ['what_to_do', 'who_are_you'],
  gather: ['why_no_rain', 'what_to_do'],
  revival: ['what_to_do', 'water_verse'],
  afterWater: ['water_verse', 'grateful'],
  light: ['balance', 'what_to_do'],
  peace: ['revival_verse', 'fitrah', 'provisional'],
};
export const QUESTION_TEXT = {
  why_no_rain: { en: "Why doesn't it rain yet?", ar: 'لماذا لم يَنزل المطر بعد؟' },
  what_to_do: { en: 'What should I do?', ar: 'ماذا أفعل؟' },
  water_verse: { en: 'What does the water verse mean?', ar: 'ما معنى آية الماء؟' },
  grateful: { en: 'Why gratitude?', ar: 'لماذا الشكر؟' },
  revival_verse: { en: 'What does the last verse say?', ar: 'ماذا تقول الآية الأخيرة؟' },
  balance: { en: 'Why not open all the clouds?', ar: 'لماذا لا أفتح السحاب كلّه؟' },
  fitrah: { en: 'What is fitrah?', ar: 'ما الفطرة؟' },
  provisional: { en: 'Why is this verse provisional?', ar: 'لماذا اختيار الآية مؤقّت؟' },
  who_are_you: { en: 'Who are you?', ar: 'من أنت؟' },
};
