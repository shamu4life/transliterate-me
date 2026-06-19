// IPA/ARPABET -> Korean Hangul. Hangul is featural: each syllable is a block
// composed from an initial consonant (choseong), a medial vowel (jungseong),
// and an optional final consonant (jongseong), combined via the Unicode
// algorithm. We follow the usual loanword strategy: consonants that cannot be
// a coda spawn their own syllable with a filler vowel (ㅡ / ㅣ), and glides
// w/y fuse with the following vowel into a compound vowel.

import { stripStress, isVowel } from '../arpabet.js';

const SBASE = 0xac00;

// consonant -> { cho: initial index, jong: final index or null if not a valid
// coda, fill: filler vowel jung index used when it must stand alone }.
const EU = 18; // ㅡ
const I = 20;  // ㅣ
const C = {
  K: { cho: 15, jong: 1, fill: EU }, G: { cho: 0, jong: 1, fill: EU },
  T: { cho: 16, jong: 19, fill: EU }, D: { cho: 3, jong: null, fill: EU },
  P: { cho: 17, jong: 17, fill: EU }, B: { cho: 7, jong: 17, fill: EU },
  F: { cho: 17, jong: null, fill: EU }, V: { cho: 7, jong: null, fill: EU },
  S: { cho: 9, jong: null, fill: EU }, Z: { cho: 12, jong: null, fill: EU },
  TH: { cho: 9, jong: null, fill: EU }, DH: { cho: 3, jong: null, fill: EU },
  SH: { cho: 9, jong: null, fill: I }, CH: { cho: 14, jong: null, fill: I },
  JH: { cho: 12, jong: null, fill: I }, ZH: { cho: 12, jong: null, fill: I },
  HH: { cho: 18, jong: null, fill: EU },
  M: { cho: 6, jong: 16, fill: EU }, N: { cho: 2, jong: 4, fill: EU },
  NG: { cho: 11, jong: 21, fill: EU }, L: { cho: 5, jong: 8, fill: EU },
  R: { cho: 5, jong: 8, fill: EU },
};

// vowel -> { jung, y (after a y-glide), w (after a w-glide), after (extra
// vowel syllable for diphthong off-glides: 'i' -> 이, 'u' -> 우) }.
const V = {
  AA: { jung: 0, y: 2, w: 9 },
  AE: { jung: 1, y: 3, w: 10 },
  AH: { jung: 4, y: 6, w: 14 },
  AO: { jung: 8, y: 12, w: 14 },
  AW: { jung: 0, after: 'u' },
  AY: { jung: 0, after: 'i' },
  EH: { jung: 5, y: 7, w: 15 },
  ER: { jung: 4, w: 14 },
  EY: { jung: 5, after: 'i' },
  IH: { jung: 20, w: 16 },
  IY: { jung: 20, w: 16 },
  OW: { jung: 8 },
  OY: { jung: 8, after: 'i' },
  UH: { jung: 13, y: 17 },
  UW: { jung: 13, y: 17 },
};

function compose(syl) {
  return String.fromCharCode(
    SBASE + (syl.cho * 21 + syl.jung) * 28 + (syl.jong || 0),
  );
}

function jungFor(vowelSym, glide) {
  const v = V[vowelSym];
  if (glide === 'Y' && v.y !== undefined) return v.y;
  if (glide === 'W' && v.w !== undefined) return v.w;
  return v.jung;
}

export function toHangul(phonemes) {
  const p = stripStress(phonemes);
  const syllables = [];
  let i = 0;

  // Emit a CV(+offglide) syllable for an onset consonant index (or 11 = ㅇ
  // silent) plus a vowel, pushing an extra syllable for any off-glide.
  function emit(cho, vowelSym, glide) {
    syllables.push({ cho, jung: jungFor(vowelSym, glide), jong: 0 });
    const after = V[vowelSym].after;
    if (after === 'i') syllables.push({ cho: 11, jung: I, jong: 0 });
    else if (after === 'u') syllables.push({ cho: 11, jung: 13, jong: 0 });
  }

  while (i < p.length) {
    const cur = p[i];
    if (isVowel(cur)) {
      emit(11, cur, null); // bare vowel -> ㅇ onset
      i += 1;
      continue;
    }
    const next = p[i + 1];
    if ((cur === 'Y' || cur === 'W') && next && isVowel(next)) {
      emit(11, next, cur); // leading glide
      i += 2;
    } else if (!C[cur]) {
      i += 1; // unmapped consonant — skip rather than crash
    } else if (next && isVowel(next)) {
      emit(C[cur].cho, next, null);
      i += 2;
    } else if ((next === 'Y' || next === 'W') && isVowel(p[i + 2])) {
      emit(C[cur].cho, p[i + 2], next);
      i += 3;
    } else {
      // coda or cluster consonant with no following vowel
      const info = C[cur];
      const last = syllables[syllables.length - 1];
      if (last && last.jong === 0 && info && info.jong !== null) {
        last.jong = info.jong; // attach as final consonant
      } else if (info) {
        syllables.push({ cho: info.cho, jung: info.fill, jong: 0 }); // filler
      }
      i += 1;
    }
  }
  return syllables.map(compose).join('');
}
