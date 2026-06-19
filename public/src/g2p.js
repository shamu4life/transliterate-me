// A small rule-based English grapheme-to-phoneme (G2P) fallback.
//
// This is only used for words that are missing from the CMU dictionary
// (typically names, slang, or typos). English spelling is famously irregular,
// so this is a best-effort approximation — it walks left to right, greedily
// matching multi-letter graphemes before single letters. The output is a list
// of ARPABET symbols (without stress) so it can flow through the same pipeline
// as dictionary results.

// Ordered list of [grapheme, [phonemes]]. Longer graphemes must come first so
// the greedy matcher prefers them (e.g. "tch" before "t", "sh" before "s").
const RULES = [
  ['tch', ['CH']],
  ['dge', ['JH']],
  ['igh', ['AY']],
  ['ough', ['AO']],
  ['augh', ['AO']],
  ['eigh', ['EY']],
  ['ch', ['CH']],
  ['ck', ['K']],
  ['sh', ['SH']],
  ['th', ['TH']],
  ['ph', ['F']],
  ['wh', ['W']],
  ['gh', []], // usually silent
  ['qu', ['K', 'W']],
  ['ng', ['NG']],
  ['nk', ['NG', 'K']],
  ['ee', ['IY']],
  ['ea', ['IY']],
  ['oo', ['UW']],
  ['ou', ['AW']],
  ['ow', ['AW']],
  ['oi', ['OY']],
  ['oy', ['OY']],
  ['oa', ['OW']],
  ['ai', ['EY']],
  ['ay', ['EY']],
  ['au', ['AO']],
  ['aw', ['AO']],
  ['ey', ['IY']],
  ['ei', ['EY']],
  ['ie', ['IY']],
  ['ue', ['UW']],
  ['ar', ['AA', 'R']],
  ['er', ['ER']],
  ['ir', ['ER']],
  ['ur', ['ER']],
  ['or', ['AO', 'R']],
  ['a', ['AE']],
  ['e', ['EH']],
  ['i', ['IH']],
  ['o', ['AA']],
  ['u', ['AH']],
  ['y', ['IY']],
  ['b', ['B']],
  ['c', ['K']],
  ['d', ['D']],
  ['f', ['F']],
  ['g', ['G']],
  ['h', ['HH']],
  ['j', ['JH']],
  ['k', ['K']],
  ['l', ['L']],
  ['m', ['M']],
  ['n', ['N']],
  ['p', ['P']],
  ['q', ['K']],
  ['r', ['R']],
  ['s', ['S']],
  ['t', ['T']],
  ['v', ['V']],
  ['w', ['W']],
  ['x', ['K', 'S']],
  ['z', ['Z']],
];

const VOWEL_LETTERS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

export function g2p(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return [];

  // Final silent 'e' lengthens a preceding vowel (cake, time, rose). Handle
  // the most common pattern: vowel + single consonant + final 'e'.
  let silentE = false;
  if (w.length >= 3 && w.endsWith('e') && !VOWEL_LETTERS.has(w[w.length - 2])
      && VOWEL_LETTERS.has(w[w.length - 3])) {
    silentE = true;
    w = w.slice(0, -1);
  }

  const phones = [];
  let i = 0;
  outer: while (i < w.length) {
    for (const [g, ph] of RULES) {
      if (w.startsWith(g, i)) {
        phones.push(...ph);
        i += g.length;
        continue outer;
      }
    }
    i += 1; // no rule matched (shouldn't happen for a-z) — skip
  }

  // Apply the silent-e lengthening to the last vowel we produced.
  if (silentE) {
    for (let j = phones.length - 1; j >= 0; j--) {
      const tense = { AE: 'EY', EH: 'IY', IH: 'AY', AA: 'OW', AH: 'UW' };
      if (tense[phones[j]]) {
        phones[j] = tense[phones[j]];
        break;
      }
    }
  }
  return phones;
}
