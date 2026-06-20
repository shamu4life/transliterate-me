// Tests for the espeak-based forward pipeline: IPA -> ARPABET mapping, the
// espeak phonemizer, and an end-to-end check against the real vendored WASM.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ipaToArpabet } from '../public/src/ipa2arpabet.js';
import { phonemizeTextEspeak } from '../public/src/phonemize.js';
import { transliterateTokens, transliteratePhonemes, SCRIPTS } from '../public/src/transliterate.js';
import { LANGUAGES } from '../public/src/lang/index.js';

const here = dirname(fileURLToPath(import.meta.url));

test('IPA -> ARPABET: affricates, diphthongs (with ZWJ), nasals', () => {
  // espeak puts a zero-width joiner inside affricates/diphthongs.
  assert.deepEqual(ipaToArpabet('həlˈo‍ʊ'), ['HH', 'AH', 'L', 'OW']);
  assert.deepEqual(ipaToArpabet('lˈæŋɡwɪd‍ʒ'), ['L', 'AE', 'NG', 'G', 'W', 'IH', 'JH']);
  assert.deepEqual(ipaToArpabet('bɔ̃ʒˈuʁ'), ['B', 'AO', 'N', 'ZH', 'UW', 'R']); // nasal ɔ̃ -> AO N
  assert.deepEqual(ipaToArpabet('nˈiɲo'), ['N', 'IY', 'N', 'Y', 'OW']); // ñ -> N Y
});

test('IPA -> ARPABET maps non-English consonants to nearest', () => {
  assert.deepEqual(ipaToArpabet('θ'), ['TH']);
  assert.deepEqual(ipaToArpabet('ɣ'), ['G']);
  assert.deepEqual(ipaToArpabet('ç'), ['HH']);
  assert.deepEqual(ipaToArpabet('ʃ'), ['SH']);
});

test('vowel length is preserved as a token and rendered by Katakana', () => {
  // Straße: espeak ʃtɾˈɑːsə -> AA carries a length token.
  const ph = ipaToArpabet('ʃtɾˈɑːsə');
  assert.deepEqual(ph, ['SH', 'T', 'R', 'AA', 'ː', 'S', 'AH']);
  // Katakana turns it into a chōonpu (ー); other scripts ignore it (no crash).
  assert.match(transliteratePhonemes(ph, 'katakana'), /ー/);
  for (const s of SCRIPTS) assert.ok(transliteratePhonemes(ph, s.id).length > 0, s.id);
});

test('phonemizeTextEspeak aligns IPA onto word tokens (stub engine)', async () => {
  // Predictable stub: returns one IPA token ("tˈest") per input word.
  const phon = async (line) => line.split(' ').map(() => 'tˈest').join(' ');
  const tokens = await phonemizeTextEspeak('hola mundo!', 'es', phon);
  const words = tokens.filter((t) => t.type === 'word');
  assert.equal(words.length, 2);
  assert.deepEqual(words[0].phonemes, ['T', 'EH', 'S', 'T']);
  assert.equal(words[0].source, 'espeak');
  // Punctuation is preserved as an "other" token.
  assert.ok(tokens.some((t) => t.type === 'other' && t.text.includes('!')));
});

test('phonemizeTextEspeak phonemizes number tokens individually', async () => {
  // Stub returns one IPA token ("tˈest") per whitespace-separated word.
  const phon = async (line) => line.split(' ').map(() => 'tˈest').join(' ');
  const tokens = await phonemizeTextEspeak('tengo 300', 'es', phon);
  const num = tokens.find((t) => t.text === '300');
  assert.ok(num, 'number token present');
  assert.equal(num.source, 'number');
  assert.ok(num.phonemes.length > 0, 'number token has phonemes');
});

test('language registry: English uses the dictionary, others use espeak', () => {
  const en = LANGUAGES.find((l) => l.id === 'en');
  assert.equal(en.engine, 'dict');
  assert.ok(LANGUAGES.length >= 10);
  assert.ok(LANGUAGES.filter((l) => l.engine === 'espeak').every((l) => l.voice));
});

// End-to-end with the real vendored espeak-ng WASM (loaded via fs, the same
// glue the browser uses). Verifies IPA quality + ARPABET mapping + a downstream
// transliteration for several languages.
test('vendored espeak-ng phonemizes multiple languages end-to-end', async () => {
  const espeakDir = join(here, '../public/vendor/espeak/');
  const mod = await import(join(espeakDir, 'espeak-ng.js'));
  const buf = readFileSync(join(espeakDir, 'espeak-ng.wasm'));
  const wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const phonemizeLine = async (text, voice) => {
    const espeak = await mod.default({
      wasmBinary,
      arguments: ['--phonout', 'o', '--sep=', '-q', '--ipa=3', '-v', voice, text],
      print() {}, printErr() {},
    });
    return espeak.FS.readFile('o', { encoding: 'utf8' }).trim();
  };

  const cases = [
    ['es', 'hola gracias'],
    ['fr', 'bonjour'],
    ['de', 'Straße'],
    ['it', 'ciao'],
    ['es', 'tengo 1,5 euros'], // European decimal comma → "uno coma cinco"
    ['de', 'media 1/2'],       // fraction → decimalized → "null komma fünf"
  ];
  for (const [voice, text] of cases) {
    const tokens = await phonemizeTextEspeak(text, voice, phonemizeLine);
    const words = tokens.filter((t) => t.type === 'word');
    assert.ok(words.every((w) => w.ipa.length > 0), `${voice}: every word has IPA`);
    assert.ok(words.every((w) => w.phonemes.length > 0), `${voice}: every word has phonemes`);
    for (const s of SCRIPTS) {
      const out = transliterateTokens(tokens, s.id);
      assert.ok(out.length > 0, `${text} -> ${s.id}`);
      assert.doesNotMatch(out, /[0-9]/, `${text} -> ${s.id} still has digits`);
    }
  }
});
