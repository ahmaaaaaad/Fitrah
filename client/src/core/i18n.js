// Language state, translation lookup and number formatting.
const listeners = new Set();
let lang = 'ar';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export const i18n = {
  get lang() { return lang; },
  get dir() { return lang === 'ar' ? 'rtl' : 'ltr'; },
  set(l) {
    lang = l === 'en' ? 'en' : 'ar';
    document.documentElement.lang = lang;
    document.documentElement.dir = this.dir;
    listeners.forEach((fn) => fn(lang));
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  /** Pick the current language from a {ar, en} object. */
  t(o) {
    if (o == null) return '';
    if (typeof o === 'string') return o;
    return o[lang] ?? o.en ?? o.ar ?? '';
  },
  num(n) { return lang === 'ar' ? String(n).replace(/\d/g, (d) => AR_DIGITS[d]) : String(n); },
  /** Fill {placeholders} in a translated template. */
  fmt(o, vars = {}) {
    return this.t(o).replace(/\{(\w+)\}/g, (_, k) => (typeof vars[k] === 'number' ? this.num(vars[k]) : vars[k] ?? ''));
  },
};
export const t = (o) => i18n.t(o);
export const arDigits = (n) => String(n).replace(/\d/g, (d) => AR_DIGITS[d]);
