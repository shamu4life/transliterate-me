// IPA/ARPABET -> Japanese Katakana, following the conventions used when
// English loanwords are adapted into Japanese. Consonant clusters and codas
// get an epenthetic vowel (usually "u", but "o" after t/d), nasal codas become
// ン, and long/tense vowels take a ー length mark. The result is an
// approximation of how the word would be written as a katakana loanword.

import { stripStress, isVowel } from '../arpabet.js';

// Consonant + vowel-slot -> katakana. Slots are a/i/u/e/o.
const CV = {
  K: { a: 'カ', i: 'キ', u: 'ク', e: 'ケ', o: 'コ', d: 'u' },
  G: { a: 'ガ', i: 'ギ', u: 'グ', e: 'ゲ', o: 'ゴ', d: 'u' },
  S: { a: 'サ', i: 'シ', u: 'ス', e: 'セ', o: 'ソ', d: 'u' },
  Z: { a: 'ザ', i: 'ジ', u: 'ズ', e: 'ゼ', o: 'ゾ', d: 'u' },
  T: { a: 'タ', i: 'ティ', u: 'トゥ', e: 'テ', o: 'ト', d: 'o' },
  D: { a: 'ダ', i: 'ディ', u: 'ドゥ', e: 'デ', o: 'ド', d: 'o' },
  N: { a: 'ナ', i: 'ニ', u: 'ヌ', e: 'ネ', o: 'ノ', d: 'u' },
  HH: { a: 'ハ', i: 'ヒ', u: 'フ', e: 'ヘ', o: 'ホ', d: 'u' },
  B: { a: 'バ', i: 'ビ', u: 'ブ', e: 'ベ', o: 'ボ', d: 'u' },
  P: { a: 'パ', i: 'ピ', u: 'プ', e: 'ペ', o: 'ポ', d: 'u' },
  M: { a: 'マ', i: 'ミ', u: 'ム', e: 'メ', o: 'モ', d: 'u' },
  R: { a: 'ラ', i: 'リ', u: 'ル', e: 'レ', o: 'ロ', d: 'u' },
  L: { a: 'ラ', i: 'リ', u: 'ル', e: 'レ', o: 'ロ', d: 'u' },
  F: { a: 'ファ', i: 'フィ', u: 'フ', e: 'フェ', o: 'フォ', d: 'u' },
  V: { a: 'ヴァ', i: 'ヴィ', u: 'ヴ', e: 'ヴェ', o: 'ヴォ', d: 'u' },
  CH: { a: 'チャ', i: 'チ', u: 'チュ', e: 'チェ', o: 'チョ', d: 'i' },
  JH: { a: 'ジャ', i: 'ジ', u: 'ジュ', e: 'ジェ', o: 'ジョ', d: 'i' },
  ZH: { a: 'ジャ', i: 'ジ', u: 'ジュ', e: 'ジェ', o: 'ジョ', d: 'i' },
  SH: { a: 'シャ', i: 'シ', u: 'シュ', e: 'シェ', o: 'ショ', d: 'i' },
  TH: { a: 'サ', i: 'シ', u: 'ス', e: 'セ', o: 'ソ', d: 'u' },
  DH: { a: 'ザ', i: 'ジ', u: 'ズ', e: 'ゼ', o: 'ゾ', d: 'u' },
  W: { a: 'ワ', i: 'ウィ', u: 'ウ', e: 'ウェ', o: 'ウォ', d: 'u' },
  Y: { a: 'ヤ', i: 'イ', u: 'ユ', e: 'イェ', o: 'ヨ', d: 'u' },
};

const INDEP = { a: 'ア', i: 'イ', u: 'ウ', e: 'エ', o: 'オ' };

// i-row kana used to build palatalised (consonant + y-glide) syllables, e.g.
// "pyu" -> ピュ. Combined with a small ャ/ュ/ョ/ェ.
const I_ROW = {
  K: 'キ', G: 'ギ', S: 'シ', Z: 'ジ', T: 'チ', D: 'ヂ', N: 'ニ', HH: 'ヒ',
  B: 'ビ', P: 'ピ', M: 'ミ', R: 'リ', L: 'リ', CH: 'チ', JH: 'ジ', SH: 'シ',
  F: 'フィ', V: 'ヴィ', TH: 'シ', DH: 'ジ', ZH: 'ジ',
};
const SMALL = { a: 'ャ', u: 'ュ', o: 'ョ', e: 'ェ', i: '' };

// ARPABET vowel -> { slot, after (extra glide kana), long }.
const VOWEL = {
  AA: { slot: 'a' }, AE: { slot: 'a' }, AH: { slot: 'a' },
  AO: { slot: 'o', long: true },
  AW: { slot: 'a', after: 'ウ' },
  AY: { slot: 'a', after: 'イ' },
  EH: { slot: 'e' },
  ER: { slot: 'a', long: true },
  EY: { slot: 'e', after: 'イ' },
  IH: { slot: 'i' }, IY: { slot: 'i', long: true },
  OW: { slot: 'o', long: true },
  OY: { slot: 'o', after: 'イ' },
  UH: { slot: 'u' }, UW: { slot: 'u', long: true },
};

function vowelExtras(v) {
  let s = '';
  if (v.after) s += v.after;
  if (v.long) s += 'ー';
  return s;
}

function cv(cons, vowelSym) {
  const table = CV[cons];
  const v = VOWEL[vowelSym];
  if (!table || !v) return '';
  return table[v.slot] + vowelExtras(v);
}

// consonant + y-glide + vowel -> palatalised mora (e.g. ピュ).
function palatal(cons, vowelSym) {
  const v = VOWEL[vowelSym];
  const base = I_ROW[cons] || (CV[cons] ? CV[cons].i : '');
  if (!base || !v) return cv(cons, vowelSym);
  return base + (SMALL[v.slot] || '') + vowelExtras(v);
}

export function toKatakana(phonemes) {
  const p = stripStress(phonemes);
  let out = '';
  let i = 0;
  while (i < p.length) {
    const cur = p[i];
    if (cur === 'ː') { // length token (from espeak) -> chōonpu
      if (!out.endsWith('ー')) out += 'ー';
      i += 1;
      continue;
    }
    if (isVowel(cur)) {
      const v = VOWEL[cur];
      out += INDEP[v.slot] + vowelExtras(v);
      i += 1;
      continue;
    }
    const next = p[i + 1];
    const nextIsVowel = next && isVowel(next);
    if ((cur === 'N' || cur === 'M' || cur === 'NG') && !nextIsVowel) {
      out += 'ン'; // syllabic / coda nasal
      i += 1;
      continue;
    }
    if (cur === 'NG' && nextIsVowel) {
      out += 'ン' + cv('G', next); // medial ŋ before a vowel, e.g. シンギング
      i += 2;
      continue;
    }
    if (next === 'Y' && isVowel(p[i + 2])) {
      out += palatal(cur, p[i + 2]); // consonant + y-glide + vowel
      i += 3;
    } else if (nextIsVowel) {
      out += cv(cur, next);
      i += 2;
    } else {
      // coda consonant: insert the consonant's default epenthetic vowel
      const table = CV[cur];
      if (cur === 'Y') out += 'イ';
      else if (cur === 'W') out += 'ウ';
      else if (table) out += table[table.d] || '';
      i += 1;
    }
  }
  return out;
}
