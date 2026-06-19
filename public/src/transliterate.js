// Dispatcher: maps a target-script id to its transliterator and applies it
// across a token stream (preserving the original whitespace/punctuation).

import { toKatakana } from './scripts/katakana.js';
import { toHangul } from './scripts/hangul.js';
import { toCyrillic } from './scripts/cyrillic.js';
import { toChinese } from './scripts/chinese.js';
import { toGreek } from './scripts/greek.js';
import { toArabic } from './scripts/arabic.js';
import { toHebrew } from './scripts/hebrew.js';

// Ordered metadata used to build the UI and drive conversion. `quality` is an
// honest signal of how faithful the mapping is: phonetic scripts map well,
// abjads lose vowel detail, and Chinese is only a rough approximation.
export const SCRIPTS = [
  { id: 'katakana', name: 'Japanese (Katakana)', fn: toKatakana, rtl: false, quality: 'good' },
  { id: 'hangul', name: 'Korean (Hangul)', fn: toHangul, rtl: false, quality: 'good' },
  { id: 'cyrillic', name: 'Russian (Cyrillic)', fn: toCyrillic, rtl: false, quality: 'good' },
  { id: 'greek', name: 'Greek', fn: toGreek, rtl: false, quality: 'fair' },
  { id: 'arabic', name: 'Arabic', fn: toArabic, rtl: true, quality: 'fair' },
  { id: 'hebrew', name: 'Hebrew', fn: toHebrew, rtl: true, quality: 'fair' },
  { id: 'chinese', name: 'Chinese (approximate)', fn: toChinese, rtl: false, quality: 'rough' },
];

const BY_ID = new Map(SCRIPTS.map((s) => [s.id, s]));

export function getScript(id) {
  return BY_ID.get(id);
}

// Transliterate a single word's ARPABET phonemes into the given script.
export function transliteratePhonemes(phonemes, scriptId) {
  const script = BY_ID.get(scriptId);
  if (!script || !phonemes || !phonemes.length) return '';
  return script.fn(phonemes);
}

// Transliterate a full token stream (from phonemizeText) into target text.
// Non-word tokens (spaces, punctuation) pass through unchanged.
export function transliterateTokens(tokens, scriptId) {
  return tokens
    .map((t) => {
      if (t.type !== 'word') return t.text;
      const out = transliteratePhonemes(t.phonemes, scriptId);
      return out || t.text; // keep original if we could not pronounce it
    })
    .join('');
}
