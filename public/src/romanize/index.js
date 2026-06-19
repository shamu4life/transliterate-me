// Romanization dispatcher: take text in any supported script and produce a
// Latin-alphabet rendering, routing each run of characters to the right
// romanizer based on its script.
//
// Han characters are shared between Chinese and Japanese, so they cannot be
// told apart by Unicode alone. We disambiguate by context: if the text contains
// kana it is treated as Japanese; an explicit `source` overrides the guess.
//
// Japanese is special: when a kuroshiro romanizer is provided (opts.japanese),
// kanji + kana runs are romanized *together* so readings and particles resolve
// in context (私は -> watashi wa). Without it, kana is romanized and kanji
// passes through. Because kuroshiro is async, romanizeText is async too.

import { detectScript, ROMANIZABLE } from './detect.js';
import { romanizeHan } from './pinyin.js';
import { romanizeKana } from './kana.js';
import { romanizeHangul } from './hangul2rr.js';
import { romanizeCyrillic, romanizeGreek, romanizeArabic, romanizeHebrew } from './alphabets.js';

export const SOURCES = [
  { id: 'auto', name: 'Auto-detect' },
  { id: 'chinese', name: 'Chinese → Pinyin' },
  { id: 'japanese', name: 'Japanese → Romaji' },
  { id: 'korean', name: 'Korean → Revised' },
  { id: 'cyrillic', name: 'Russian → Latin' },
  { id: 'greek', name: 'Greek → Latin' },
  { id: 'arabic', name: 'Arabic → Latin' },
  { id: 'hebrew', name: 'Hebrew → Latin' },
];

const KANA_RE = /[぀-ヿｦ-ﾝ]/;

export function isJapanese(text, source) {
  return source === 'japanese' || (source === 'auto' && KANA_RE.test(text));
}

// Map a character to a romanizer key. Returns null for pass-through characters.
function classify(ch, ctx) {
  const sc = detectScript(ch);
  if (!ROMANIZABLE.has(sc)) return null;
  if (sc === 'han' || sc === 'kana') {
    if (ctx.japaneseMode) return ctx.japanese ? 'jp' : (sc === 'kana' ? 'kana' : null);
    return sc === 'kana' ? 'kana' : 'han';
  }
  return sc;
}

// Report the dominant romanizable script in the text (for UI display).
export function detectPrimary(text) {
  const counts = {};
  for (const ch of text) {
    const sc = detectScript(ch);
    if (ROMANIZABLE.has(sc)) counts[sc] = (counts[sc] || 0) + 1;
  }
  let best = null;
  let max = 0;
  for (const [sc, n] of Object.entries(counts)) {
    if (n > max) { max = n; best = sc; }
  }
  if (best === 'han') return KANA_RE.test(text) ? 'kana' : 'han';
  return best;
}

export async function romanizeText(text, opts = {}) {
  const ctx = {
    japaneseMode: isJapanese(text, opts.source || 'auto'),
    japanese: opts.japanese,
  };
  const fns = {
    jp: (s) => opts.japanese(s),
    han: (s) => romanizeHan(s, opts.pinyin, { tones: opts.tones }),
    kana: romanizeKana,
    hangul: romanizeHangul,
    cyrillic: romanizeCyrillic,
    greek: romanizeGreek,
    arabic: romanizeArabic,
    hebrew: romanizeHebrew,
  };

  let out = '';
  let i = 0;
  while (i < text.length) {
    const key = classify(text[i], ctx);
    if (!key) { out += text[i]; i += 1; continue; }
    let seg = '';
    while (i < text.length && classify(text[i], ctx) === key) {
      seg += text[i];
      i += 1;
    }
    out += await fns[key](seg);
  }
  return out;
}
