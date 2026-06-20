// Turn text into a sequence of tokens, each annotated with its pronunciation
// (ARPABET phonemes + derived IPA). Whitespace and punctuation are preserved as
// "other" tokens so the original layout survives.
//
// The grapheme-to-phoneme step is pluggable: English uses the CMU dictionary
// plus a rule fallback, while other languages pass a language-specific rule
// converter (and no dictionary).

import { arpabetToIpa } from './arpabet.js';
import { g2p as englishG2p } from './g2p.js';
import { ipaToArpabet } from './ipa2arpabet.js';
import { NUMBER_SRC, numberToWords, fractionToCommaDecimal } from './numbers.js';

// Word source shared with the master tokenizer.
const WORD_SRC = "[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+(?:[''][A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+)*";
// NUMBER first so "300" wins over a letter run; group 1 = number, group 2 = word.
const TOKEN_RE = new RegExp(`(${NUMBER_SRC})|(${WORD_SRC})`, 'giu');

// Split text into word/other tokens. Numbers are word tokens tagged `numeric`.
// A leading "-" immediately before a number is folded in as a sign only when it
// is not itself preceded by a letter or digit (so "3-5" and "page-3" are ranges/
// hyphens, while " -5" and "(-5)" are negative).
export function tokenize(text) {
  const tokens = [];
  let last = 0;
  let m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(text)) !== null) {
    let start = m.index;
    let value = m[0];
    const numeric = m[1] !== undefined;
    if (numeric && start > 0 && text[start - 1] === '-'
        && !/[A-Za-z0-9]/.test(text[start - 2] || '')) {
      start -= 1;
      value = `-${value}`;
    }
    if (start > last) tokens.push({ type: 'other', text: text.slice(last, start) });
    tokens.push({ type: 'word', text: value, numeric });
    last = m.index + m[0].length;
  }
  if (last < text.length) tokens.push({ type: 'other', text: text.slice(last) });
  return tokens;
}

// Look up a single word's pronunciation. Tries the dictionary first (if given),
// then the rule-based g2p. Returns { phonemes, source } or null.
export function phonemizeWord(word, dict, g2p = englishG2p) {
  const key = word.toLowerCase();
  if (dict && dict.has(key)) {
    return { phonemes: dict.get(key), source: 'dict' };
  }
  // Strip a possessive/plural "'s" and retry (e.g. "Anna's").
  if (key.endsWith("'s") && dict && dict.has(key.slice(0, -2))) {
    return { phonemes: [...dict.get(key.slice(0, -2)), 'Z'], source: 'dict' };
  }
  const rule = g2p(key);
  if (rule.length) return { phonemes: rule, source: 'rule' };
  return null;
}

// Split text into word and non-word tokens, attaching pronunciation data.
// Numeric tokens are spelled out (numberToWords) then phonemized word-by-word.
export function phonemizeText(text, dict, g2p = englishG2p) {
  const tokens = tokenize(text);
  for (const tok of tokens) {
    if (tok.type !== 'word') continue;
    if (tok.numeric) {
      const phon = [];
      for (const w of numberToWords(tok.text).split(' ')) {
        const pron = phonemizeWord(w, dict, g2p);
        if (pron) phon.push(...pron.phonemes);
      }
      tok.phonemes = phon;
      tok.ipa = phon.length ? arpabetToIpa(phon) : '';
      tok.source = phon.length ? 'number' : 'none';
    } else {
      const pron = phonemizeWord(tok.text, dict, g2p);
      tok.phonemes = pron ? pron.phonemes : [];
      tok.ipa = pron ? arpabetToIpa(pron.phonemes) : '';
      tok.source = pron ? pron.source : 'none';
    }
  }
  return tokens;
}

// Phonemize text with espeak-ng (non-English). Word tokens are phonemized in one
// batched espeak call (with a per-word fallback on count mismatch); numeric
// tokens are phonemized individually — espeak expands them natively per-voice,
// and individual calls sidestep the whitespace-alignment break when a number
// expands to several words (e.g. 1999). Fractions are decimalized first because
// espeak reads a slash literally ("one slash two").
export async function phonemizeTextEspeak(text, voice, phonemizeLine) {
  const tokens = tokenize(text);
  const wordIdx = [];
  const wordTexts = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok.type !== 'word') continue;
    if (tok.numeric) {
      const send = tok.text.includes('/')
        ? (fractionToCommaDecimal(tok.text) || tok.text)
        : tok.text;
      const ipa = (await phonemizeLine(send, voice)).trim();
      tok.ipa = ipa;
      tok.phonemes = ipaToArpabet(ipa);
      tok.source = 'number';
    } else {
      tok.ipa = '';
      tok.phonemes = [];
      tok.source = 'espeak';
      wordIdx.push(i);
      wordTexts.push(tok.text);
    }
  }
  if (wordTexts.length) {
    const line = await phonemizeLine(wordTexts.join(' '), voice);
    let ipaWords = line.split(/\s+/).filter(Boolean);
    if (ipaWords.length !== wordTexts.length) {
      ipaWords = [];
      for (const w of wordTexts) ipaWords.push((await phonemizeLine(w, voice)).trim());
    }
    wordTexts.forEach((_, k) => {
      const tok = tokens[wordIdx[k]];
      tok.ipa = ipaWords[k] || '';
      tok.phonemes = ipaToArpabet(tok.ipa);
    });
  }
  return tokens;
}
