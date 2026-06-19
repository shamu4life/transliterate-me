// Korean Hangul -> Revised Romanization of Korean.
//
// Each Hangul syllable block is decomposed (the inverse of the U+AC00 formula)
// into initial/medial/final jamo. Unlike a naive per-syllable mapping, we then
// apply the main cross-syllable sound-change rules that RR is based on:
//   - liaison: a final consonant before a vowel (ㅇ onset) moves to the onset
//     (한국어 -> hangugeo);
//   - ㄴ/ㄹ assimilation -> ll (신라 -> silla, 설날 -> seollal);
//   - nasalisation of stop finals before ㄴ/ㅁ (국물 -> gungmul);
//   - aspiration around ㅎ (좋다 -> jota, 축하 -> chuka).
// Less common rules (e.g. palatalisation, some double-batchim clusters) are not
// applied, so a few words still differ from the official form.

const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '',
  'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae',
  'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
const JONG = ['', 'k', 'kk', 'ks', 'n', 'nj', 'nh', 't', 'l', 'lk', 'lm', 'lb',
  'ls', 'lt', 'lp', 'lh', 'm', 'p', 'bs', 't', 't', 'ng', 't', 't', 'k', 't',
  'p', 'h'];

// A final consonant's onset spelling when it liaises onto a following vowel.
const ONSET_OF_JONG = {
  1: 'g', 2: 'kk', 4: 'n', 7: 'd', 8: 'r', 16: 'm', 17: 'b', 19: 's',
  20: 'ss', 22: 'j', 23: 'ch', 24: 'k', 25: 't', 26: 'p', 27: 'h',
};
// Final-consonant sound groups (by jongseong index).
const K_FINAL = new Set([1, 2, 3, 9, 24]);
const T_FINAL = new Set([7, 19, 20, 22, 23, 25]);
const P_FINAL = new Set([11, 14, 17, 18, 26]);
// ㅎ-final + plain stop onset -> aspirated stop (by choseong index).
const ASP_AFTER_H = { 0: 'k', 3: 't', 12: 'ch', 7: 'p' };

const SBASE = 0xac00;
const SLAST = 0xd7a3;

function decompose(ch) {
  const cp = ch.codePointAt(0);
  if (cp < SBASE || cp > SLAST) return null;
  const s = cp - SBASE;
  return {
    cho: Math.floor(s / (21 * 28)),
    jung: Math.floor((s % (21 * 28)) / 28),
    jong: s % 28,
  };
}

// Apply the boundary rule between syllable `a` and the following syllable `b`,
// mutating their romanized parts (a.jongR, b.choR).
function applyBoundary(a, b) {
  const J = a.jong;
  const C = b.cho;
  if (J === 0) return;
  // Aspiration around ㅎ.
  if (J === 27 && ASP_AFTER_H[C] !== undefined) { a.jongR = ''; b.choR = ASP_AFTER_H[C]; return; }
  if (C === 18) { // ㅎ onset after a stop final
    if (K_FINAL.has(J)) { a.jongR = ''; b.choR = 'k'; return; }
    if (T_FINAL.has(J)) { a.jongR = ''; b.choR = 't'; return; }
    if (P_FINAL.has(J)) { a.jongR = ''; b.choR = 'p'; return; }
  }
  // ㄴ/ㄹ assimilation -> ll.
  if (J === 4 && C === 5) { a.jongR = 'l'; b.choR = 'l'; return; }
  if (J === 8 && (C === 2 || C === 5)) { a.jongR = 'l'; b.choR = 'l'; return; }
  // Nasalisation of stop finals before ㄴ/ㅁ.
  if (C === 2 || C === 6) {
    if (K_FINAL.has(J)) { a.jongR = 'ng'; return; }
    if (T_FINAL.has(J)) { a.jongR = 'n'; return; }
    if (P_FINAL.has(J)) { a.jongR = 'm'; return; }
  }
  // Liaison: final moves to the next onset before a vowel (ㅇ), except ㅇ itself.
  if (C === 11 && J !== 21 && ONSET_OF_JONG[J] !== undefined) {
    b.choR = ONSET_OF_JONG[J];
    a.jongR = '';
  }
}

export function romanizeHangul(segment) {
  const items = [...segment].map((ch) => {
    const d = decompose(ch);
    if (!d) return { syl: false, ch };
    return {
      syl: true, cho: d.cho, jong: d.jong,
      choR: CHO[d.cho], jungR: JUNG[d.jung], jongR: JONG[d.jong],
    };
  });
  for (let i = 0; i < items.length - 1; i++) {
    if (items[i].syl && items[i + 1].syl) applyBoundary(items[i], items[i + 1]);
  }
  return items.map((it) => (it.syl ? it.choR + it.jungR + it.jongR : it.ch)).join('');
}
