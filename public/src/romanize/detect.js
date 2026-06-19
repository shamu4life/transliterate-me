// Detect which writing system a character belongs to, by Unicode range. Used
// to route each run of input text to the right romanizer.

const RANGES = [
  ['han', 0x3400, 0x4dbf], // CJK Extension A
  ['han', 0x4e00, 0x9fff], // CJK Unified Ideographs
  ['han', 0xf900, 0xfaff], // CJK Compatibility Ideographs
  ['kana', 0x3040, 0x309f], // Hiragana
  ['kana', 0x30a0, 0x30ff], // Katakana
  ['kana', 0xff66, 0xff9d], // Half-width Katakana
  ['hangul', 0x1100, 0x11ff], // Hangul Jamo
  ['hangul', 0x3130, 0x318f], // Hangul Compatibility Jamo
  ['hangul', 0xac00, 0xd7a3], // Hangul Syllables
  ['cyrillic', 0x0400, 0x04ff],
  ['greek', 0x0370, 0x03ff],
  ['greek', 0x1f00, 0x1fff], // Greek Extended
  ['arabic', 0x0600, 0x06ff],
  ['arabic', 0xfb50, 0xfdff], // Arabic Presentation Forms-A
  ['arabic', 0xfe70, 0xfeff], // Arabic Presentation Forms-B
  ['hebrew', 0x0590, 0x05ff],
  ['hebrew', 0xfb1d, 0xfb4f], // Hebrew Presentation Forms
];

// Return a script id for a single character, or 'latin'/'other'.
export function detectScript(ch) {
  const cp = ch.codePointAt(0);
  for (const [name, lo, hi] of RANGES) {
    if (cp >= lo && cp <= hi) return name;
  }
  if ((cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) ||
      (cp >= 0xc0 && cp <= 0x24f)) return 'latin';
  return 'other';
}

// Which scripts we can romanize (everything else passes through unchanged).
export const ROMANIZABLE = new Set([
  'han', 'kana', 'hangul', 'cyrillic', 'greek', 'arabic', 'hebrew',
]);
