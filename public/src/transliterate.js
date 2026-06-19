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
// abjads lose vowel detail, and Chinese (logographic) is approximated with
// valid Mandarin syllables in the name-transcription style. An optional `note`
// overrides the generic per-quality blurb in the UI. `wordSep`, when set, is the
// character placed between adjacent transliterated words instead of an ASCII
// space — the interpunct (·) for Chinese and the nakaguro (・) for Katakana,
// the idiomatic separators for the parts of a foreign name in those scripts.
export const SCRIPTS = [
  { id: 'katakana', name: 'Japanese (Katakana)', fn: toKatakana, rtl: false, quality: 'good', wordSep: '・' },
  { id: 'hangul', name: 'Korean (Hangul)', fn: toHangul, rtl: false, quality: 'good' },
  { id: 'cyrillic', name: 'Russian (Cyrillic)', fn: toCyrillic, rtl: false, quality: 'good' },
  { id: 'greek', name: 'Greek', fn: toGreek, rtl: false, quality: 'fair' },
  { id: 'arabic', name: 'Arabic', fn: toArabic, rtl: true, quality: 'fair' },
  { id: 'hebrew', name: 'Hebrew', fn: toHebrew, rtl: true, quality: 'fair' },
  { id: 'chinese', name: 'Chinese (approximate)', fn: toChinese, rtl: false, quality: 'fair', wordSep: '·',
    note: 'Chinese is logographic, so this approximates the sound with valid Mandarin syllables mapped to standard transcription characters (the way foreign names are written).' },
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
// Non-word tokens (spaces, punctuation) pass through unchanged, except that for
// scripts with a `wordSep` a run of spaces/tabs sitting between two words is
// replaced by that separator (the interpunct/nakaguro). Newlines and any
// punctuation are left intact so the original layout survives.
export function transliterateTokens(tokens, scriptId) {
  const script = BY_ID.get(scriptId);
  const sep = script && script.wordSep;
  let out = '';
  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.type === 'word') {
      const w = transliteratePhonemes(t.phonemes, scriptId);
      out += w || t.text; // keep original if we could not pronounce it
    } else if (sep && /^[^\S\n]+$/.test(t.text)
        && tokens[i - 1] && tokens[i - 1].type === 'word'
        && tokens[i + 1] && tokens[i + 1].type === 'word') {
      out += sep; // spaces between two words -> idiomatic foreign-name separator
    } else {
      out += t.text;
    }
  }
  return out;
}
