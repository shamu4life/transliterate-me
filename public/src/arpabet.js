// ARPABET phoneme utilities and ARPABET -> IPA conversion.
//
// The CMU Pronouncing Dictionary encodes pronunciations in ARPABET, where
// vowels carry a stress digit (0 = unstressed, 1 = primary, 2 = secondary).
// We keep ARPABET as the canonical internal phoneme representation because it
// is unambiguous and easy to map to every output script. IPA is derived from
// it purely for display.

// The 15 ARPABET vowels (without stress digits) and the consonants.
export const VOWELS = new Set([
  'AA', 'AE', 'AH', 'AO', 'AW', 'AY', 'EH', 'ER',
  'EY', 'IH', 'IY', 'OW', 'OY', 'UH', 'UW',
]);

export const CONSONANTS = new Set([
  'B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L', 'M', 'N',
  'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH',
]);

// Base ARPABET -> IPA for consonants and for vowels at their default quality.
const IPA_CONSONANTS = {
  B: 'b', CH: 'tʃ', D: 'd', DH: 'ð', F: 'f', G: 'ɡ', HH: 'h', JH: 'dʒ',
  K: 'k', L: 'l', M: 'm', N: 'n', NG: 'ŋ', P: 'p', R: 'ɹ', S: 's',
  SH: 'ʃ', T: 't', TH: 'θ', V: 'v', W: 'w', Y: 'j', Z: 'z', ZH: 'ʒ',
};

const IPA_VOWELS = {
  AA: 'ɑ', AE: 'æ', AO: 'ɔ', AW: 'aʊ', AY: 'aɪ', EH: 'ɛ',
  EY: 'eɪ', IH: 'ɪ', IY: 'i', OW: 'oʊ', OY: 'ɔɪ', UH: 'ʊ', UW: 'u',
};

// Strip the trailing stress digit, returning [bareSymbol, stress|null].
export function splitStress(symbol) {
  const m = /^([A-Z]+)([0-2])?$/.exec(symbol);
  if (!m) return [symbol, null];
  return [m[1], m[2] === undefined ? null : Number(m[2])];
}

export function isVowel(symbol) {
  return VOWELS.has(splitStress(symbol)[0]);
}

// Convert a single ARPABET symbol (with optional stress digit) to IPA.
function symbolToIpa(symbol) {
  const [bare, stress] = splitStress(symbol);
  if (VOWELS.has(bare)) {
    let ipa;
    if (bare === 'AH') {
      ipa = stress === 0 ? 'ə' : 'ʌ'; // reduced AH is schwa
    } else if (bare === 'ER') {
      ipa = stress === 0 ? 'ɚ' : 'ɝ'; // r-coloured vowel
    } else {
      ipa = IPA_VOWELS[bare] || bare.toLowerCase();
    }
    return { ipa, stress };
  }
  return { ipa: IPA_CONSONANTS[bare] || bare.toLowerCase(), stress: null };
}

// Convert an array of ARPABET symbols to an IPA string. Primary/secondary
// stress marks (ˈ ˌ) are placed immediately before the stressed vowel, which
// is a reasonable approximation without full syllabification.
export function arpabetToIpa(symbols) {
  let out = '';
  for (const sym of symbols) {
    const { ipa, stress } = symbolToIpa(sym);
    if (stress === 1) out += 'ˈ';
    else if (stress === 2) out += 'ˌ';
    out += ipa;
  }
  return out;
}

// Drop stress digits from a list of ARPABET symbols.
export function stripStress(symbols) {
  return symbols.map((s) => splitStress(s)[0]);
}
