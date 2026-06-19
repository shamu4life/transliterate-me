// IPA/ARPABET -> Arabic script. Arabic is an abjad: consonants are letters,
// long vowels use the matres lectionis ا/و/ي, and short vowels are written as
// harakat diacritics (fatha/kasra/damma) on the preceding consonant. Because the
// forward direction knows the pronunciation, we can mark the short vowels (a
// word-initial vowel takes a carrier alif). Several English sounds (p, v, g)
// have no native letter and use the closest equivalent — an approximation.

import { stripStress, isVowel } from '../arpabet.js';

const CONS = {
  B: 'ب', CH: 'تش', D: 'د', DH: 'ذ', F: 'ف', G: 'غ', HH: 'ه', JH: 'ج',
  K: 'ك', L: 'ل', M: 'م', N: 'ن', NG: 'نغ', P: 'ب', R: 'ر', S: 'س',
  SH: 'ش', T: 'ت', TH: 'ث', V: 'ف', W: 'و', Y: 'ي', Z: 'ز', ZH: 'ج',
};

const FATHA = 'َ'; // a
const KASRA = 'ِ'; // i
const DAMMA = 'ُ'; // u

// Short vowels -> harakat diacritics (attach to the preceding consonant).
const SHORT = { AE: FATHA, EH: FATHA, AH: FATHA, IH: KASRA, UH: DAMMA };
// Long vowels / diphthongs -> mater-lectionis letters.
const LONG = {
  AA: 'ا', AO: 'و', IY: 'ي', UW: 'و', OW: 'و', EY: 'ي', ER: 'ير',
  AW: 'او', AY: 'اي', OY: 'وي',
};

export function toArabic(phonemes) {
  const p = stripStress(phonemes);
  let out = '';
  let prevCons = false;
  for (const sym of p) {
    if (sym === 'ː') continue;
    if (isVowel(sym)) {
      if (SHORT[sym]) {
        out += (prevCons ? '' : 'ا') + SHORT[sym]; // carrier alif if word-initial
      } else {
        out += LONG[sym] || '';
      }
      prevCons = false;
    } else {
      out += CONS[sym] || '';
      prevCons = true;
    }
  }
  return out;
}
