// Unit tests for the transliteration engine. Run with `npm test`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseCmudict } from '../public/src/dict.js';
import { arpabetToIpa } from '../public/src/arpabet.js';
import { g2p } from '../public/src/g2p.js';
import { phonemizeText, phonemizeWord } from '../public/src/phonemize.js';
import { transliterateTokens, transliteratePhonemes, SCRIPTS } from '../public/src/transliterate.js';

const here = dirname(fileURLToPath(import.meta.url));
const dict = parseCmudict(readFileSync(join(here, '../public/data/cmudict.txt'), 'utf8'));

test('dictionary loads a sane number of entries', () => {
  assert.ok(dict.size > 100000, `expected >100k entries, got ${dict.size}`);
  assert.deepEqual(dict.get('hello'), ['HH', 'AH0', 'L', 'OW1']);
});

test('ARPABET -> IPA renders stress and key phonemes', () => {
  assert.equal(arpabetToIpa(['HH', 'AH0', 'L', 'OW1']), 'həlˈoʊ');
  // Stress marks are placed immediately before the stressed vowel.
  assert.equal(arpabetToIpa(['TH', 'IH1', 'NG', 'K']), 'θˈɪŋk');
});

test('phonemizeWord uses the dictionary, falls back to rules', () => {
  assert.equal(phonemizeWord('hello', dict).source, 'dict');
  const made = phonemizeWord('zxqweburg', dict);
  assert.equal(made.source, 'rule');
  assert.ok(made.phonemes.length > 0);
});

test('g2p produces phonemes for an unknown word', () => {
  assert.ok(g2p('blorptastic').length > 0);
});

test('phonemizeText preserves punctuation and spacing', () => {
  const toks = phonemizeText('hi, there!', dict);
  assert.equal(toks.map((t) => t.text).join(''), 'hi, there!');
  assert.ok(toks.some((t) => t.type === 'word' && t.text === 'hi'));
});

// Golden outputs for the well-supported phonetic scripts. These pin down the
// expected behaviour so future mapping tweaks are intentional.
const GOLDEN = {
  hello: { katakana: 'ハロー', hangul: '허로', cyrillic: 'хало' },
  world: { katakana: 'ワールド', hangul: '월드', chinese: '沃勒德' },
  computer: { hangul: '컴퓨터', katakana: 'カンピューター' },
  smith: { katakana: 'スミス', hangul: '스미스', chinese: '斯米斯' },
};

for (const [word, expected] of Object.entries(GOLDEN)) {
  test(`transliterate "${word}"`, () => {
    const toks = phonemizeText(word, dict);
    for (const [scriptId, want] of Object.entries(expected)) {
      assert.equal(transliterateTokens(toks, scriptId), want,
        `${word} -> ${scriptId}`);
    }
  });
}

test('every script returns a non-empty string for a normal word', () => {
  const { phonemes } = phonemizeWord('language', dict);
  for (const s of SCRIPTS) {
    const out = transliteratePhonemes(phonemes, s.id);
    assert.ok(out && out.length > 0, `${s.id} produced empty output`);
  }
});

test('unknown-but-pronounceable words still transliterate', () => {
  const toks = phonemizeText('Kaitlyn', dict);
  assert.ok(transliterateTokens(toks, 'katakana').length > 0);
});

// Regression: every ARPABET consonant must map in every script. A missing entry
// previously crashed Hangul on ZH (the ʒ in "vision", "measure", "bonjour").
test('every ARPABET consonant transliterates in every script (no crash/drop)', () => {
  const CONSONANTS = ['B', 'CH', 'D', 'DH', 'F', 'G', 'HH', 'JH', 'K', 'L',
    'M', 'N', 'NG', 'P', 'R', 'S', 'SH', 'T', 'TH', 'V', 'W', 'Y', 'Z', 'ZH'];
  for (const c of CONSONANTS) {
    const phonemes = [c, 'AA1']; // consonant + a vowel
    for (const s of SCRIPTS) {
      const out = transliteratePhonemes(phonemes, s.id);
      assert.ok(out && out.length > 0, `${c} produced no output in ${s.id}`);
    }
  }
});

test('Chinese transliteration produces only Han characters (no pinyin leak)', () => {
  for (const word of ['hello', 'strawberry', 'computer', 'washington', 'jennifer', 'world']) {
    const out = transliterateTokens(phonemizeText(word, dict), 'chinese');
    assert.ok(out.length > 0);
    assert.doesNotMatch(out, /[a-z]/i, `${word} -> ${out} still has pinyin`);
  }
});

// A long coda consonant cluster has no Mandarin equivalent: each consonant
// would otherwise become its own epenthetic syllable, reading as disjointed
// staccato through a TTS. Clusters of 3+ collapse to the first consonant plus a
// trailing sibilant; shorter codas are left intact.
test('Chinese collapses long coda clusters instead of exploding them', () => {
  // "texts" /t ɛ k s t s/ would be 特克斯特斯 (5 syllables) without collapsing.
  assert.equal(transliteratePhonemes(['T', 'EH1', 'K', 'S', 'T', 'S'], 'chinese'), '特克斯');
  // "sixths" /s ɪ k s θ s/ keeps the salient k and a single trailing sibilant.
  assert.equal(transliteratePhonemes(['S', 'IH1', 'K', 'S', 'TH', 'S'], 'chinese'), '斯克斯');
  // A 2-consonant coda is short enough to keep intact (matches the world golden).
  assert.equal(transliteratePhonemes(['W', 'ER1', 'L', 'D'], 'chinese'), '沃勒德');
});

// Chinese and Katakana write the parts of a foreign name with an interpunct
// (·) / nakaguro (・) rather than a space, which also gives a TTS a clean word
// boundary. Spaced scripts keep ordinary spaces; punctuation and layout survive.
test('Chinese and Katakana separate words with the idiomatic interpunct', () => {
  const toks = phonemizeText('hello world', dict);
  assert.equal(transliterateTokens(toks, 'chinese'), '哈楼·沃勒德');
  assert.equal(transliterateTokens(toks, 'katakana'), 'ハロー・ワールド');
  assert.equal(transliterateTokens(toks, 'cyrillic'), 'хало вэрлд'); // spaced script unchanged
  // A separator token carrying punctuation is left alone (no interpunct added).
  assert.doesNotMatch(transliterateTokens(phonemizeText('hi, there', dict), 'chinese'), /·/);
  // Newlines are preserved so the original layout survives.
  assert.match(transliterateTokens(phonemizeText('a\nb', dict), 'chinese'), /\n/);
});

test('words containing the ʒ sound transliterate everywhere', () => {
  for (const word of ['vision', 'measure', 'genre']) {
    const toks = phonemizeText(word, dict);
    for (const s of SCRIPTS) {
      assert.ok(transliterateTokens(toks, s.id).length > 0, `${word} -> ${s.id}`);
    }
  }
});
