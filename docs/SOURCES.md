# Sources, tools and licenses

## Qur'an text and translations
| Item | Source | Via | License / terms |
| --- | --- | --- | --- |
| Uthmani Arabic text | The Noble Qur'an Encyclopedia (quranenc.com) | npm `quran-json@3.1.2` (`dist/quran.json`, sha256 `d8a8adff387f60ce3ff7dbe3238dd9b27120bfe29d8fcb07ad2e89cad37cefd4`) | Package: CC BY-SA 4.0. Original text per QuranEnc terms |
| English translation of meanings | Saheeh International | tanzil.net, via npm `quran-json@3.1.2` (`dist/quran_en.json`, sha256 `bae3acab517304dc2684d65949a00f31000a92818041cefabc234663da99d7a3`) | Package: CC BY-SA 4.0. Original per Tanzil terms |

**Rules**
- `data/quran/verses.json` is generated. Never edit `text_uthmani` by hand.
- Before release, cross-check each verse against quranenc.com and record the reviewer's sign-off (`review_status`).
- The text uses Madani-mushaf marks (for example ٱ ۡ ٰ). Render it with a Qur'an-capable font such as Amiri Quran (`@fontsource/amiri-quran`, OFL-1.1).
- Label English text as "translation of meaning", never "translation of the Qur'an".

## Recitation audio
Not chosen yet. Pick one reciter for the whole game and record the license here before use.

## Code libraries
| Library | Version | License |
| --- | --- | --- |
| three | 0.169.0 | MIT |
| gsap | 3.x | GreenSock standard license (free for this use) |
| vite | 5.x | MIT |
