// Tests for the reverse direction: any script -> Latin romanization.
// Note: romanizeText is async (Japanese romanization via kuroshiro is async).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { pinyin } from '../public/vendor/pinyin-pro.mjs';
import { romanizeKana } from '../public/src/romanize/kana.js';
import { romanizeHangul } from '../public/src/romanize/hangul2rr.js';
import { romanizeCyrillic, romanizeGreek, romanizeArabic, romanizeHebrew } from '../public/src/romanize/alphabets.js';
import { romanizeText, detectPrimary, isJapanese } from '../public/src/romanize/index.js';

test('Chinese -> pinyin with tone marks', async () => {
  assert.equal(await romanizeText('中文', { pinyin }), 'zhōng wén');
  assert.equal(await romanizeText('你好世界', { pinyin }), 'nǐ hǎo shì jiè');
});

test('pinyin resolves context-dependent polyphones', async () => {
  assert.equal(await romanizeText('长大', { pinyin }), 'zhǎng dà');
  assert.equal(await romanizeText('长城', { pinyin }), 'cháng chéng');
  assert.equal(await romanizeText('银行', { pinyin }), 'yín háng');
  assert.equal(await romanizeText('行人', { pinyin }), 'xíng rén');
});

test('pinyin supports numbered tones', async () => {
  assert.equal(await romanizeText('拼音', { pinyin, tones: 'numbers' }), 'pin1 yin1');
});

test('Japanese kana -> romaji (youon, gemination, long vowel)', () => {
  assert.equal(romanizeKana('にほん'), 'nihon');
  assert.equal(romanizeKana('とうきょう'), 'toukyou');
  assert.equal(romanizeKana('しゃしん'), 'shashin'); // youon
  assert.equal(romanizeKana('がっこう'), 'gakkou'); // gemination
  assert.equal(romanizeKana('コーヒー'), 'koohii'); // katakana + long vowel
});

test('Korean Hangul -> Revised Romanization', () => {
  assert.equal(romanizeHangul('한국'), 'hanguk');
  assert.equal(romanizeHangul('안녕'), 'annyeong');
  assert.equal(romanizeHangul('서울'), 'seoul');
});

test('Korean RR applies cross-syllable sound-change rules', () => {
  assert.equal(romanizeHangul('신라'), 'silla'); // ㄴ+ㄹ -> ll
  assert.equal(romanizeHangul('설날'), 'seollal'); // ㄹ+ㄴ -> ll
  assert.equal(romanizeHangul('한국어'), 'hangugeo'); // liaison
  assert.equal(romanizeHangul('국물'), 'gungmul'); // nasalisation
  assert.equal(romanizeHangul('좋다'), 'jota'); // ㅎ aspiration
  assert.equal(romanizeHangul('축하'), 'chuka'); // stop + ㅎ
  assert.equal(romanizeHangul('감사합니다'), 'gamsahamnida');
});

test('Cyrillic and Greek romanization', () => {
  assert.equal(romanizeCyrillic('привет'), 'privet');
  assert.equal(romanizeGreek('Ελλάδα'), 'Ellada');
});

test('Arabic/Hebrew matres become vowels; niqqud/harakat applied', () => {
  // Weak letters read as vowels after a consonant.
  assert.equal(romanizeHebrew('שלום'), 'shlom'); // ו -> o (was "shlvm")
  assert.equal(romanizeArabic('نور'), 'nur'); // و -> u
  assert.equal(romanizeArabic('مكتوب'), 'mktub');
  // Vocalized input recovers short vowels too.
  assert.equal(romanizeHebrew('שָׁלוֹם'), 'shalom');
});

test('without a Japanese analyzer, kanji passes through; Chinese forced reading works', async () => {
  // Kana present -> Japanese mode; with no analyzer injected, kanji passes through.
  assert.equal(await romanizeText('東京タワー', { pinyin }), '東京tawaa');
  // Forcing Chinese reads the same kanji as pinyin.
  assert.equal(await romanizeText('東京', { pinyin, source: 'chinese' }), 'dōng jīng');
});

test('with a Japanese analyzer, kanji+kana romanize together', async () => {
  const japanese = async (s) => `[jp:${s}]`; // stub analyzer
  // The whole Japanese run (kanji + kana) goes to the analyzer as one segment.
  assert.equal(await romanizeText('東京タワー', { pinyin, japanese }), '[jp:東京タワー]');
  assert.equal(isJapanese('東京タワー', 'auto'), true);
  assert.equal(isJapanese('中文', 'auto'), false); // no kana -> Chinese
});

test('detectPrimary identifies the dominant script', () => {
  assert.equal(detectPrimary('你好'), 'han');
  assert.equal(detectPrimary('こんにちは'), 'kana');
  assert.equal(detectPrimary('日本語です'), 'kana'); // kana present -> Japanese
  assert.equal(detectPrimary('안녕'), 'hangul');
  assert.equal(detectPrimary('hello'), null);
});

test('Latin text and punctuation pass through unchanged', async () => {
  assert.equal(await romanizeText('hello, world!', { pinyin }), 'hello, world!');
  assert.equal(await romanizeText('中文 mix 123', { pinyin }), 'zhōng wén mix 123');
});

// End-to-end: load the real vendored kuroshiro bundle + dictionary through a
// disk-backed XMLHttpRequest shim (the same code path the browser uses).
test('kuroshiro vendored bundle romanizes kanji (real dictionary)', async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const dictDir = join(here, '../public/vendor/kuromoji-dict/');
  globalThis.XMLHttpRequest = class {
    open(method, url) { this.url = url; }
    send() {
      try {
        const buf = readFileSync(this.url);
        this.status = 200;
        this.response = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      } catch { this.status = 404; }
      if (this.onload) this.onload();
    }
  };
  const m = await import('../public/vendor/kuroshiro.bundle.mjs');
  await m.init(dictDir);
  assert.equal(await m.toRomaji('日本語'), 'nihongo');
  assert.equal(await romanizeText('私は学生です', { pinyin, japanese: m.toRomaji }),
    'watashi wa gakusei desu');
});
