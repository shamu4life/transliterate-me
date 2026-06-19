// IPA/ARPABET -> Hebrew script. Hebrew is an abjad: consonants are letters,
// long vowels add the matres lectionis ו/י, and vowels are marked with niqqud
// points on the preceding consonant (a word-initial vowel takes a carrier alef).
// Sounds absent from Hebrew (ch, j, zh) use a letter plus geresh (׳). Five
// letters take a final form at word end, applied as a last step. Approximate.

import { stripStress, isVowel } from '../arpabet.js';

const CONS = {
  B: 'ב', CH: 'צ׳', D: 'ד', DH: 'ד', F: 'פ', G: 'ג', HH: 'ה', JH: 'ג׳',
  K: 'ק', L: 'ל', M: 'מ', N: 'נ', NG: 'נג', P: 'פ', R: 'ר', S: 'ס',
  SH: 'ש', T: 'ט', TH: 'ת', V: 'ב', W: 'ו', Y: 'י', Z: 'ז', ZH: 'ז׳',
};

// Niqqud point per vowel (attaches to the preceding consonant / carrier).
const POINT = {
  AA: 'ָ', AE: 'ַ', AH: 'ַ', AO: 'ֹ', EH: 'ֶ', ER: 'ֶ', EY: 'ֵ',
  IH: 'ִ', IY: 'ִ', OW: 'ֹ', OY: 'ֹ', UH: 'ֻ', UW: 'ֻ', AW: 'ַ', AY: 'ַ',
};
// Mater letter appended after the point for long vowels / diphthongs.
const MATER = {
  IY: 'י', EY: 'י', OW: 'ו', AO: 'ו', UW: 'ו', AY: 'י', AW: 'ו', OY: 'וי',
};

// Letters with a distinct word-final form.
const FINAL = { כ: 'ך', מ: 'ם', נ: 'ן', פ: 'ף', צ: 'ץ' };

export function toHebrew(phonemes) {
  const p = stripStress(phonemes);
  let out = '';
  let prevCons = false;
  for (const sym of p) {
    if (sym === 'ː') continue;
    if (isVowel(sym)) {
      out += (prevCons ? '' : 'א') + (POINT[sym] || '') + (MATER[sym] || '');
      prevCons = false;
    } else {
      out += CONS[sym] || '';
      prevCons = true;
    }
  }
  // Apply the final-form letter if the word ends in one of them (allowing a
  // trailing niqqud point or geresh after the consonant).
  const m = /([כמנפצ])([׳ׁׂ֐-ׇ]*)$/.exec(out);
  if (m) out = out.slice(0, m.index) + FINAL[m[1]] + m[2];
  return out;
}
