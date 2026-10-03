// Dalil's authored words for the slice. Every item carries its content type so
// the interface can show what it is. Dalil never quotes the Qur'an in Arabic and
// never presents the player (or himself) as the cause of rain, life or light.
// Status: authored for the prototype, pending content and Sharia review.
import { CT } from '../events.js';

export const REVIEW_STATUS = 'prototype-authored, pending review';
const N = CT.NARRATIVE_DIALOGUE, E = CT.EDUCATIONAL_CONTEXT, X = CT.DALIL_EXPLANATION;

export const LINES = {
  current_notice: { type: N, en: 'Do you see that?', ar: 'أترى ذلك؟' },
  current_follow: { type: N, en: 'Follow it.', ar: 'اتبعه.' },
  current_where: { type: E, en: 'The wind is carrying moisture up from the slopes. Look where it is taking it.', ar: 'الريح تحمل الرطوبة من السفوح… انظر إلى أين تمضي بها.' },
  rain_listen: { type: N, en: 'Listen.', ar: 'أنصِت.' },
  rain_closer: { type: N, en: 'Look closer.', ar: 'انظر عن قرب.' },
  soil_explain: { type: E, en: 'When rain reaches dry ground it fills the cracks first and softens the crust. Seeds that waited in the dry soil begin to sprout once they have water.', ar: 'حين يصل المطر إلى الأرض الجافة يملأ الشقوق أولًا ويليّن قشرتها، والبذور التي كانت تنتظر في التربة الجافة تبدأ بالإنبات حين تجد الماء.' },
  water_moving: { type: N, en: 'It is moving. Follow it.', ar: 'إنه يجري… اتبعه.' },
  water_explain: { type: E, en: 'Water follows the slope of the land and gathers in the low places, until it becomes a stream.', ar: 'الماء يتبع انحدار الأرض ويجتمع في المنخفضات حتى يصير جدولًا.' },
  meadow_come: { type: N, en: 'Come. Something is happening down there.', ar: 'تعال… شيءٌ يحدث هناك.' },
  flower_look: { type: N, en: 'Look at this one.', ar: 'انظر إلى هذه.' },
  chain_prompt: { type: N, en: 'Follow the way it came, from the cloud down to the flower.', ar: 'تتبّع الطريق الذي جاء منه، من السحاب نزولًا إلى الزهرة.' },
  chain_explain: { type: E, en: 'Cloud, rain, soil, water, flower. Each one needs the one before it, and none of them is the source of the others.', ar: 'سحاب، فمطر، فتربة، فماء، فزهرة. كلٌّ منها يحتاج إلى ما قبله، ولا شيء منها مصدرٌ لغيره.' },
  light_notice: { type: N, en: 'The clouds are thinning there. Look.', ar: 'السحاب يرقّ هناك… انظر.' },
  light_after: { type: E, en: 'The sun did not arrive just now. It was there all along, behind the clouds.', ar: 'الشمس لم تأتِ الآن… كانت هناك طوال الوقت خلف السحاب.' },
  closing: { type: N, en: 'The signs were here before we noticed them.', ar: 'كانت هذه الآيات هنا قبل أن ننتبه لها.' },
  // one gentle observation after a stall; never an instruction to control anything
  stall_trace: { type: N, en: 'Stay with it as it moves.', ar: 'ابقَ معه وهو يمضي.' },
  stall_reveal: { type: N, en: 'Look through the rain.', ar: 'انظر من خلال المطر.' },
  stall_water: { type: N, en: 'Stay with the water.', ar: 'ابقَ مع الماء.' },
  stall_connect: { type: N, en: 'Start at the cloud, and follow it down.', ar: 'ابدأ من السحاب، وتتبّعه نزولًا.' },
  stall_align: { type: N, en: 'Keep your eyes on the cloud that is thinning.', ar: 'أبقِ نظرك على السحابة التي ترقّ.' },
};

// Dalil's explanation of each passage: the third layer, shown apart from the
// Arabic text and the translation, only after the player has had time to read.
export const EXPLAIN = {
  '56:68-70': {
    type: X,
    en: 'We have just watched rain reach the earth. These verses turn our attention to that same water: who brings it down from the clouds? Not us. They add that it could have been made bitter, and close by asking why we are not grateful.',
    ar: 'رأينا قبل قليل المطر يصل إلى الأرض. وهذه الآيات تلفت نظرنا إلى هذا الماء نفسه: من الذي يُنزله من السحاب؟ لسنا نحن. وتذكّر بأنه كان يمكن أن يكون مُرًّا لا يُشرب، ثم تسألنا عن الشكر.',
  },
  '57:17': {
    type: X,
    en: 'This verse says that Allah gives life to the earth after its lifelessness, and that the signs have been made clear so that we may understand. The valley we walked through is one such sign: dry earth, then rain, then life.',
    ar: 'تقرّر هذه الآية أن الله يُعيد الحياة إلى الأرض بعد أن كانت هامدة، وأنه بيّن الآيات لعلّنا نفهم. والوادي الذي مشينا فيه علامةٌ من ذلك: أرضٌ جافة، ثم مطر، ثم حياة.',
  },
  '30:50': {
    type: X,
    en: 'This verse asks us to look at the traces of Allah’s mercy: how He gives life to the earth after its lifelessness. It goes on to say that the One who does this gives life to the dead, and that nothing is beyond His power.',
    ar: 'تدعونا هذه الآية إلى النظر في آثار رحمة الله: كيف يُعيد الحياة إلى الأرض بعد أن كانت هامدة. ثم تذكر أن الذي يفعل ذلك يُحيي الموتى، وأن قدرته لا يعجزها شيء.',
  },
};

// The silence budget: how many lines Dalil may speak in each sequence, and the
// least quiet between two of them. Explanations count against the budget too.
export const SILENCE = {
  arrival: { maxLines: 0, gap: 0 },
  current: { maxLines: 3, gap: 6 },
  rain: { maxLines: 3, gap: 5 },
  water: { maxLines: 2, gap: 8 },
  verse1: { maxLines: 1, gap: 0 },
  meadow: { maxLines: 3, gap: 6 },
  light: { maxLines: 2, gap: 8 },
  final: { maxLines: 2, gap: 6 },
  peace: { maxLines: 0, gap: 0 },
};

// Reviewed answers, matched by intent (fallback level 1). Citations use verse keys only.
export const ANSWERS = {
  what_is_happening: {
    type: N, keys: ['what is happening', 'what happened', 'what is this', 'ماذا يحدث', 'ما هذا', 'ما الذي'],
    en: 'Something that happens in every valley like this: wind carries moisture, clouds gather, rain falls, and dry ground comes back to life. We are here to notice it.',
    ar: 'شيءٌ يحدث في كل وادٍ كهذا: الريح تحمل الرطوبة، والسحاب يجتمع، والمطر ينزل، والأرض الجافة تعود إليها الحياة. ونحن هنا لننتبه له.', cite: [],
  },
  what_to_do: {
    type: N, keys: ['what do', 'what should', 'how', 'help', 'stuck', 'ماذا أفعل', 'كيف', 'ساعد'],
    en: 'Follow what you notice: trace it as it moves, or look through what hides it. You are not changing anything; you are paying attention.',
    ar: 'تتبّع ما تلاحظه: سِر معه وهو يتحرك، أو انظر من خلال ما يحجبه. أنت لا تغيّر شيئًا، بل تنتبه.', cite: [],
  },
  seeds: {
    type: E, keys: ['seed', 'grass', 'grow', 'sprout', 'بذور', 'عشب', 'تنبت', 'ينبت'],
    en: 'Many seeds can lie dry in the soil for a long time. When water reaches them they swell and begin to sprout.',
    ar: 'كثيرٌ من البذور يبقى جافًّا في التربة زمنًا طويلًا، فإذا وصلها الماء انتفخت وبدأت بالإنبات.', cite: [],
  },
  rain_science: {
    type: E, keys: ['rain', 'cloud', 'why does it rain', 'مطر', 'سحاب', 'غيم'],
    en: 'Moist air rises and cools; its water gathers into droplets that form clouds. When the droplets grow heavy enough, they fall as rain.',
    ar: 'يرتفع الهواء الرطب فيبرد، فيتجمع ماؤه قطراتٍ تكوّن السحاب، فإذا ثقلت القطرات نزلت مطرًا.', cite: [],
  },
  water_verse: {
    type: X, keys: ['water verse', 'verse', 'mean', 'drink', 'الماء', 'الآية', 'معنى', 'تشربون'],
    en: 'It asks us to look at the water we drink: we did not bring it down from the clouds. The fitting answer is gratitude.',
    ar: 'تدعونا إلى التأمّل في الماء الذي نشربه: لسنا نحن من أنزله من السحاب. والجواب اللائق هو الشكر.', cite: ['56:68-70'],
  },
  grateful: {
    type: X, keys: ['grateful', 'thank', 'bitter', 'gratitude', 'شكر', 'تشكرون', 'أجاج'],
    en: 'The water is a gift we could not have made, and it could have been bitter. The verse ends by asking why we are not grateful.',
    ar: 'الماء نعمةٌ لم نصنعها، وكان يمكن أن يكون مُرًّا لا يُشرب. وتختم الآية بسؤالنا عن الشكر.', cite: ['56:68-70'],
  },
  revival_verse: {
    type: X, keys: ['life', 'earth', 'dead', 'revive', 'final', 'last verse', 'الأرض', 'يحيي', 'موتها', 'الحياة', 'الأخيرة'],
    en: 'It says Allah gives life to the earth after its lifelessness, and that the signs are made clear so we might understand. The meadow is one such sign.',
    ar: 'تقول إن الله يُعيد الحياة إلى الأرض بعد أن كانت هامدة، وإنه بيّن الآيات لعلّنا نفهم. وهذا المرج علامةٌ من تلك العلامات.', cite: ['57:17', '41:39'],
  },
  light: {
    type: E, keys: ['light', 'sun', 'clouds open', 'shaft', 'نور', 'الشمس', 'ضوء'],
    en: 'The sun was there all along, behind the clouds. When they thinned, its light reached the meadow.',
    ar: 'الشمس كانت هناك طوال الوقت خلف السحاب، فلما رقّ السحاب وصل نورها إلى المرج.', cite: [],
  },
  chain: {
    type: E, keys: ['chain', 'connect', 'cloud to flower', 'سلسلة', 'من السحاب'],
    en: 'Cloud, rain, soil, water, flower: each one needs the one before it, and none of them is the source of the others.',
    ar: 'سحاب، فمطر، فتربة، فماء، فزهرة: كلٌّ منها يحتاج إلى ما قبله، ولا شيء منها مصدرٌ لغيره.', cite: [],
  },
  fitrah: {
    type: X, keys: ['fitrah', 'fitra', 'nature', 'name', 'فطرة', 'الفطرة'],
    en: 'Fitrah is the original nature people are created with. The project takes its name from it.',
    ar: 'الفطرة هي الطبيعة الأولى التي خُلق عليها الإنسان، ومنها أخذ المشروع اسمه.', cite: ['30:30'],
  },
  provisional: {
    type: N, keys: ['provisional', 'review', 'why this verse', 'alternative', 'مؤقت', 'مراجعة', 'بديل'],
    en: 'The final verse is a provisional choice. It needs verification and Sharia review before it is final; 30:50 is the alternative.',
    ar: 'اختيار الآية الأخيرة مؤقّت، ويحتاج إلى تحقّق ومراجعة شرعية قبل اعتماده؛ والآية ٣٠:٥٠ هي البديل.', cite: ['57:17', '30:50'],
  },
  who_are_you: {
    type: N, keys: ['who are you', 'dalil', 'your name', 'من أنت', 'دليل'],
    en: 'I am Dalil, a small light walking with you. I share only what I have a source for.',
    ar: 'أنا دليل، نورٌ صغير يمشي معك. لا أقول إلا ما لديّ مصدرٌ له.', cite: [],
  },
};
export const UNKNOWN = { type: N, en: "I don't have a reliable source for that.", ar: 'ليس لديّ مصدرٌ موثوق لذلك.' };

// Two or three questions offered in the ask ribbon, by sequence.
export const SUGGEST = {
  arrival: ['what_is_happening', 'who_are_you'],
  current: ['what_is_happening', 'rain_science'],
  rain: ['seeds', 'rain_science'],
  water: ['what_to_do', 'seeds'],
  verse1: ['water_verse', 'grateful'],
  meadow: ['chain', 'water_verse'],
  light: ['light', 'what_to_do'],
  final: ['revival_verse', 'provisional'],
  peace: ['revival_verse', 'fitrah', 'provisional'],
};
export const QUESTION_TEXT = {
  what_is_happening: { en: 'What is happening here?', ar: 'ماذا يحدث هنا؟' },
  what_to_do: { en: 'What should I do?', ar: 'ماذا أفعل؟' },
  seeds: { en: 'Where did the grass come from?', ar: 'من أين جاء العشب؟' },
  rain_science: { en: 'How does rain form?', ar: 'كيف يتكوّن المطر؟' },
  water_verse: { en: 'What does the water verse mean?', ar: 'ما معنى آية الماء؟' },
  grateful: { en: 'Why gratitude?', ar: 'لماذا الشكر؟' },
  revival_verse: { en: 'What does the last verse say?', ar: 'ماذا تقول الآية الأخيرة؟' },
  light: { en: 'Where did the light come from?', ar: 'من أين جاء النور؟' },
  chain: { en: 'What connects the cloud and the flower?', ar: 'ما الذي يربط السحاب بالزهرة؟' },
  fitrah: { en: 'What is fitrah?', ar: 'ما الفطرة؟' },
  provisional: { en: 'Why is this verse provisional?', ar: 'لماذا اختيار الآية مؤقّت؟' },
  who_are_you: { en: 'Who are you?', ar: 'من أنت؟' },
};
