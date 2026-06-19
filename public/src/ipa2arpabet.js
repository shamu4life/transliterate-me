// Convert an IPA string (from espeak-ng --ipa=3) into a list of ARPABET
// phonemes, mapping each sound to its nearest English/ARPABET equivalent so the
// existing target-script transliterators can consume it unchanged.
//
// Stress is ignored (transliterators strip stress; the IPA display uses espeak's
// own string), but VOWEL LENGTH is preserved as a 'ː' token after a long vowel —
// Katakana renders it as a ー chōonpu; other scripts ignore it. espeak inserts
// zero-width joiners inside affricates/diphthongs (t‍ʃ, o‍ʊ) — those are stripped
// first. A nasalised vowel (base + combining tilde U+0303) becomes vowel + N.

export const LENGTH = 'ː'; // length marker token in the ARPABET stream

const VOWELS = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER',
  'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
]);

// Two-codepoint sequences, checked before single characters.
const SEQ = {
  tʃ: ['CH'], dʒ: ['JH'], ts: ['T', 'S'], dz: ['D', 'Z'], pf: ['P', 'F'],
  aɪ: ['AY'], aʊ: ['AW'], ɔɪ: ['OY'], oʊ: ['OW'], eɪ: ['EY'], ɛɪ: ['EY'],
  ɔʏ: ['OY'], ɔø: ['OY'],
};

const ONE = {
  // vowels
  ɑ: ['AA'], a: ['AA'], ɒ: ['AA'], æ: ['AE'], ʌ: ['AH'], ə: ['AH'], ɐ: ['AH'],
  ɔ: ['AO'], ɛ: ['EH'], e: ['EH'], ɪ: ['IH'], i: ['IY'], ɨ: ['IH'], o: ['OW'],
  ʊ: ['UH'], u: ['UW'], ʉ: ['UW'], ɯ: ['UW'], ɜ: ['ER'], ɝ: ['ER'], ɚ: ['ER'],
  ø: ['ER'], œ: ['ER'], y: ['UW'], ʏ: ['UH'], ɵ: ['UH'],
  // consonants
  b: ['B'], d: ['D'], f: ['F'], ɡ: ['G'], g: ['G'], h: ['HH'], j: ['Y'],
  k: ['K'], l: ['L'], m: ['M'], n: ['N'], ŋ: ['NG'], p: ['P'], r: ['R'],
  ɹ: ['R'], ɾ: ['R'], ʁ: ['R'], ʀ: ['R'], s: ['S'], ʃ: ['SH'], t: ['T'],
  v: ['V'], w: ['W'], z: ['Z'], ʒ: ['ZH'], θ: ['TH'], ð: ['DH'], x: ['HH'],
  ç: ['HH'], ɣ: ['G'], β: ['V'], ɲ: ['N', 'Y'], ʎ: ['L', 'Y'], ɸ: ['F'],
  c: ['K'], ɟ: ['JH'], q: ['K'], ħ: ['HH'], ʕ: ['HH'], ʔ: [], ɬ: ['L'],
  ɭ: ['L'], ɱ: ['M'], ɳ: ['N'], ʐ: ['ZH'], ʂ: ['SH'], ɕ: ['SH'], ʑ: ['ZH'],
  ʈ: ['T'], ɖ: ['D'],
};

export function ipaToArpabet(ipa) {
  const s = [...ipa.replace(/[‍‌]/g, '')]; // strip ZW(N)J
  const out = [];
  let i = 0;
  while (i < s.length) {
    const two = s[i] + (s[i + 1] ?? '');
    if (SEQ[two]) { out.push(...SEQ[two]); i += 2; continue; }
    const c = s[i];
    if (ONE[c]) {
      const mapped = ONE[c];
      out.push(...mapped);
      i += 1;
      // A length mark after a vowel becomes a length token.
      if (s[i] === 'ː' && VOWELS.has(mapped[mapped.length - 1])) {
        out.push(LENGTH);
        i += 1;
      }
      if (s[i] === '̃') { out.push('N'); i += 1; } // nasal vowel
      continue;
    }
    // Skip stress/length marks and any remaining combining diacritics.
    i += 1;
  }
  return out;
}
