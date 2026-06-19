// IPA/ARPABET -> Greek alphabet. Modern Greek lacks several English sounds, so
// voiced stops use the conventional digraphs (μπ ντ γκ) and the result is a
// phonetic approximation. Word-final sigma is written ς.

import { stripStress, isVowel } from '../arpabet.js';

const CONS = {
  B: 'μπ', CH: 'τσ', D: 'ντ', DH: 'δ', F: 'φ', G: 'γκ', HH: 'χ', JH: 'τζ',
  K: 'κ', L: 'λ', M: 'μ', N: 'ν', NG: 'γκ', P: 'π', R: 'ρ', S: 'σ',
  SH: 'σ', T: 'τ', TH: 'θ', V: 'β', W: 'ου', Y: 'ι', Z: 'ζ', ZH: 'ζ',
};

const VOW = {
  AA: 'α', AE: 'α', AH: 'α', AO: 'ο', AW: 'αου', AY: 'αϊ', EH: 'ε',
  ER: 'ερ', EY: 'ει', IH: 'ι', IY: 'ι', OW: 'ο', OY: 'οϊ', UH: 'ου', UW: 'ου',
};

export function toGreek(phonemes) {
  const p = stripStress(phonemes);
  let out = '';
  for (const sym of p) {
    if (isVowel(sym)) out += VOW[sym] || '';
    else out += CONS[sym] || '';
  }
  return out.replace(/σ$/, 'ς');
}
