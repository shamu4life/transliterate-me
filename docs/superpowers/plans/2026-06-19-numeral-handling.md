# Phonetic Numeral Handling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In forward mode, spell out numerals so they are pronounced and transliterated phonetically into the target script, for all 14 source languages, covering integers, decimals, negatives, comma/dot grouping, years, ordinals, currency, percent, and fractions.

**Architecture:** A new pure module `src/numbers.js` provides an English number-to-words function (US convention) plus a fraction→decimal helper. A shared `tokenize()` in `src/phonemize.js` recognizes numeric tokens (intact composite forms). The English/dict path expands numbers with `numberToWords` then phonemizes the resulting words; the espeak path sends numeric tokens to espeak individually (espeak expands them natively per-voice), decimalizing fractions first since espeak cannot read a slash.

**Tech Stack:** Plain ES modules (no framework, no transpiler, no dependencies). Tests run under `node --test`. Files in `public/` are served to the browser verbatim.

## Global Constraints

- **Plain ES modules only** — no bundler syntax, no `node_modules` imports inside `public/`. Every source file must run both in the browser and under `node --test`. (verbatim from CLAUDE.md)
- **No dependencies** — `package.json` has no `dependencies`; tests use only `node:test`/`node:assert`.
- **No regex lookbehind** — Safari shipped lookbehind only in 16.4; avoid it so the module parses everywhere. The leading-minus sign is resolved in `tokenize()` code, not the regex.
- **Registries are the extension points** — do not change the `SCRIPTS`/`LANGUAGES`/`SOURCES` registries for this feature.
- **Golden-output tests pin behavior** — new golden values are computed from the real engine and must match exactly.
- **English path stays instant/offline** — never route English numbers through espeak.
- **US convention for English** (`.`=decimal, `,`=grouping); the 13 espeak languages are all comma-decimal and handled by espeak per-voice.

---

### Task 1: `src/numbers.js` — number-to-words + fraction helper

**Files:**
- Create: `public/src/numbers.js`
- Test: `test/numbers.test.mjs`

**Interfaces:**
- Consumes: nothing (pure, no imports).
- Produces:
  - `NUMBER_SRC: string` — regex *source* for a numeric token core (no sign), e.g. `'[$£€¥]?(?:\\d+\\/\\d+|\\d+(?:[.,]\\d+)*)(?:%|st|nd|rd|th)?'`. Used by the tokenizer to compose its master regex.
  - `NUMBER_RE: RegExp` — anchored, case-insensitive, unicode matcher (`^(?:NUMBER_SRC)$`) for "is this string a numeric core?" (sign excluded).
  - `numberToWords(token: string) => string` — lowercase, space-separated English words (US convention). Falls back to the original `token` only for degenerate forms (e.g. `a/0`).
  - `fractionToCommaDecimal(token: string) => string | null` — `a/b` → comma-decimal value string rounded to 6 dp, trailing zeros trimmed (`'1/2'`→`'0,5'`). Returns `null` for non-fractions or `b===0`.

- [ ] **Step 1: Write the failing test**

Create `test/numbers.test.mjs`:

```js
// Unit tests for the numeral spell-out module (pure, US-English convention).
import test from 'node:test';
import assert from 'node:assert/strict';
import { numberToWords, fractionToCommaDecimal, NUMBER_RE } from '../public/src/numbers.js';

test('cardinals', () => {
  assert.equal(numberToWords('0'), 'zero');
  assert.equal(numberToWords('7'), 'seven');
  assert.equal(numberToWords('300'), 'three hundred');
  assert.equal(numberToWords('1,000'), 'one thousand');
  assert.equal(numberToWords('1000000'), 'one million');
  assert.equal(numberToWords('305'), 'three hundred five'); // US: no "and"
});

test('decimals and leading zeros', () => {
  assert.equal(numberToWords('3.14'), 'three point one four');
  assert.equal(numberToWords('0.5'), 'zero point five');
  assert.equal(numberToWords('007'), 'zero zero seven');
});

test('negatives', () => {
  assert.equal(numberToWords('-5'), 'minus five');
});

test('years (1100–2099 heuristic)', () => {
  assert.equal(numberToWords('1999'), 'nineteen ninety nine');
  assert.equal(numberToWords('1905'), 'nineteen oh five');
  assert.equal(numberToWords('1900'), 'nineteen hundred');
  assert.equal(numberToWords('2000'), 'two thousand');
  assert.equal(numberToWords('2005'), 'two thousand five');
  assert.equal(numberToWords('2019'), 'twenty nineteen');
  assert.equal(numberToWords('1000'), 'one thousand'); // below 1100 = not a year
  assert.equal(numberToWords('2100'), 'two thousand one hundred'); // above 2099 = not a year
});

test('ordinals', () => {
  assert.equal(numberToWords('1st'), 'first');
  assert.equal(numberToWords('2nd'), 'second');
  assert.equal(numberToWords('3rd'), 'third');
  assert.equal(numberToWords('21st'), 'twenty first');
  assert.equal(numberToWords('100th'), 'one hundredth');
});

test('currency', () => {
  assert.equal(numberToWords('$300'), 'three hundred dollars');
  assert.equal(numberToWords('$1'), 'one dollar');
  assert.equal(numberToWords('$3.50'), 'three dollars and fifty cents');
  assert.equal(numberToWords('$0.99'), 'ninety nine cents');
  assert.equal(numberToWords('£5'), 'five pounds');
});

test('percent', () => {
  assert.equal(numberToWords('50%'), 'fifty percent');
  assert.equal(numberToWords('3.5%'), 'three point five percent');
});

test('fractions (idiomatic)', () => {
  assert.equal(numberToWords('1/2'), 'one half');
  assert.equal(numberToWords('3/4'), 'three quarters');
  assert.equal(numberToWords('2/3'), 'two thirds');
  assert.equal(numberToWords('22/7'), 'twenty two sevenths');
  assert.equal(numberToWords('1/100'), 'one hundredth');
  assert.equal(numberToWords('4/1'), 'four');
  assert.equal(numberToWords('1/0'), '1/0'); // degenerate: original text
});

test('fractionToCommaDecimal', () => {
  assert.equal(fractionToCommaDecimal('1/2'), '0,5');
  assert.equal(fractionToCommaDecimal('22/7'), '3,142857');
  assert.equal(fractionToCommaDecimal('300'), null);
  assert.equal(fractionToCommaDecimal('1/0'), null);
});

test('NUMBER_RE matches cores, not signs or hyphens', () => {
  for (const s of ['300', '1,000', '3.14', '1/2', '1st', '50%', '$300', '1.000,50']) {
    assert.ok(NUMBER_RE.test(s), `should match ${s}`);
  }
  for (const s of ['abc', '3-5', '-5', '']) {
    assert.ok(!NUMBER_RE.test(s), `should not match ${s}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/numbers.test.mjs`
Expected: FAIL — `Cannot find module '../public/src/numbers.js'`.

- [ ] **Step 3: Write the implementation**

Create `public/src/numbers.js`:

```js
// Spell out numerals (English, US convention) for the forward pipeline, plus a
// fraction→decimal helper shared with the espeak path. Pure and offline — no
// engine deps, no regex lookbehind (Safari < 16.4), runnable in browser + node.

// Token *core* pattern (sign excluded — the tokenizer folds in a leading minus
// when it is a sign, not a hyphen). Captures composite numeric forms intact so
// the espeak path receives the whole unit ($300, 1st, 3.14, 50%, 1.000,50, 1/2).
export const NUMBER_SRC =
  '[$£€¥]?(?:\\d+\\/\\d+|\\d+(?:[.,]\\d+)*)(?:%|st|nd|rd|th)?';

// Anchored matcher for "is this whole string a numeric core?" (sign excluded).
export const NUMBER_RE = new RegExp(`^(?:${NUMBER_SRC})$`, 'iu');

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy',
  'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function digitByDigit(digits) {
  return [...digits].map((d) => ONES[Number(d)]).join(' ');
}

function below1000(n) {
  const w = [];
  if (n >= 100) { w.push(ONES[Math.floor(n / 100)], 'hundred'); n %= 100; }
  if (n >= 20) { w.push(TENS[Math.floor(n / 10)]); n %= 10; if (n) w.push(ONES[n]); }
  else if (n > 0) w.push(ONES[n]);
  return w.join(' ');
}

// Cardinal words for a string of digits (no separators/sign). Beyond 10^15 the
// scale words run out, so read the digits one at a time.
function cardinal(digits) {
  if (/^0*$/.test(digits)) return 'zero';
  if (digits.length > 15) return digitByDigit(digits);
  let n = Number(digits);
  const groups = [];
  let scale = 0;
  while (n > 0) {
    const g = n % 1000;
    if (g) groups.unshift(below1000(g) + (SCALES[scale] ? ` ${SCALES[scale]}` : ''));
    n = Math.floor(n / 1000);
    scale += 1;
  }
  return groups.join(' ');
}

const ORD_ONES = { one: 'first', two: 'second', three: 'third', five: 'fifth',
  eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };
const ORD_TENS = { twenty: 'twentieth', thirty: 'thirtieth', forty: 'fortieth',
  fifty: 'fiftieth', sixty: 'sixtieth', seventy: 'seventieth',
  eighty: 'eightieth', ninety: 'ninetieth' };

// Ordinal words for a string of digits: cardinal, then make the last word ordinal.
function ordinal(digits) {
  const parts = cardinal(digits).split(' ');
  const i = parts.length - 1;
  const last = parts[i];
  if (ORD_ONES[last]) parts[i] = ORD_ONES[last];
  else if (ORD_TENS[last]) parts[i] = ORD_TENS[last];
  else parts[i] = `${last}th`; // four→fourth, six→sixth, ten→tenth, hundred→hundredth
  return parts.join(' ');
}

// Four-digit year reading for 1100–2099 (the caller gates the range).
function yearWords(s) {
  const hi = Number(s.slice(0, 2));
  const lo = Number(s.slice(2));
  if (hi === 20 && lo < 10) return `two thousand${lo ? ` ${ONES[lo]}` : ''}`;
  const hiWords = cardinal(String(hi));
  if (lo === 0) return `${hiWords} hundred`;
  if (lo < 10) return `${hiWords} oh ${ONES[lo]}`;
  return `${hiWords} ${cardinal(String(lo))}`;
}

// comma-strip + decimal/leading-zero/cardinal (no sign, no year heuristic).
function numberValue(t) {
  const s = t.replace(/,/g, '');
  const dm = /^(\d*)\.(\d+)$/.exec(s);
  if (dm) return `${cardinal(dm[1] || '0')} point ${digitByDigit(dm[2])}`;
  if (/^0\d/.test(s)) return digitByDigit(s); // leading-zero run: 007 → zero zero seven
  return cardinal(s);
}

const CURRENCY = { $: 'dollar', '£': 'pound', '€': 'euro', '¥': 'yen' };

function currencyWords(raw, unit) {
  const t = raw.replace(/,/g, '');
  const dm = /^(\d*)\.(\d{1,2})$/.exec(t);
  if (dm) {
    const dollars = dm[1] || '0';
    const cents = String(Number(dm[2].padEnd(2, '0')));
    const dPart = Number(dollars) === 0 ? '' : `${cardinal(dollars)} ${unit}${Number(dollars) === 1 ? '' : 's'}`;
    const cPart = Number(cents) === 0 ? '' : `${cardinal(cents)} cent${Number(cents) === 1 ? '' : 's'}`;
    if (dPart && cPart) return `${dPart} and ${cPart}`;
    return dPart || cPart || `zero ${unit}s`;
  }
  const dollars = t.replace(/\.\d*$/, '') || '0';
  return `${cardinal(dollars)} ${unit}${Number(dollars) === 1 ? '' : 's'}`;
}

// Idiomatic English fraction words, or null for a/0 (caller falls back).
function fractionWords(numStr, denStr) {
  const den = Number(denStr);
  if (den === 0) return null;
  if (den === 1) return cardinal(numStr);
  let name;
  if (den === 2) name = 'half';
  else if (den === 4) name = 'quarter';
  else name = ordinal(denStr);
  if (Number(numStr) !== 1) name = name === 'half' ? 'halves' : `${name}s`;
  return `${cardinal(numStr)} ${name}`;
}

// Spell out one numeric token (US convention). Falls back to the original text
// only for degenerate forms (e.g. a/0).
export function numberToWords(token) {
  let t = String(token).trim();
  let sign = '';
  if (t[0] === '-') { sign = 'minus '; t = t.slice(1); }

  if (CURRENCY[t[0]]) return sign + currencyWords(t.slice(1), CURRENCY[t[0]]);
  if (t.endsWith('%')) return `${sign}${numberValue(t.slice(0, -1))} percent`;

  let m = /^(\d+)\/(\d+)$/.exec(t);
  if (m) { const fw = fractionWords(m[1], m[2]); return fw == null ? token : sign + fw; }

  m = /^(\d+)(?:st|nd|rd|th)$/i.exec(t);
  if (m) return sign + ordinal(m[1]);

  const bare = t.replace(/,/g, '');
  if (/^\d{4}$/.test(bare) && Number(bare) >= 1100 && Number(bare) <= 2099) {
    return sign + yearWords(bare);
  }
  return sign + numberValue(t);
}

// espeak path: a/b → comma-decimal value (6 dp, trailing zeros trimmed).
// Returns null for non-fractions or b===0 (caller sends the original token).
export function fractionToCommaDecimal(token) {
  const m = /^(\d+)\/(\d+)$/.exec(String(token).trim());
  if (!m) return null;
  const den = Number(m[2]);
  if (den === 0) return null;
  const s = (Number(m[1]) / den).toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return s.replace('.', ',');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/numbers.test.mjs`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit**

```bash
git add public/src/numbers.js test/numbers.test.mjs
git commit -m "feat: add numeral spell-out module (src/numbers.js)"
```

---

### Task 2: shared `tokenize()` + numbers in the English/dict path

**Files:**
- Modify: `public/src/phonemize.js` (add `tokenize`, rewrite `phonemizeText`; leave `phonemizeTextEspeak` on the old loop until Task 3)
- Test: `test/engine.test.mjs` (add tokenizer + English-number cases)

**Interfaces:**
- Consumes: `NUMBER_SRC`, `numberToWords` from `./numbers.js`; existing `phonemizeWord`, `arpabetToIpa`.
- Produces:
  - `tokenize(text: string) => Array<{type:'word'|'other', text:string, numeric?:boolean}>` — word tokens carry `numeric`; gaps are `other`. A leading `-` directly before a number and not preceded by a letter/digit is folded into the token as a sign.
  - `phonemizeText` now expands `numeric` word tokens via `numberToWords` (source `'number'`).

- [ ] **Step 1: Write the failing test**

Add to `test/engine.test.mjs` — extend the import on line 11 to include `tokenize`:

```js
import { phonemizeText, phonemizeWord, tokenize } from '../public/src/phonemize.js';
```

Then append these tests:

```js
test('tokenize: numbers are numeric word tokens, layout preserved', () => {
  const toks = tokenize('I have 300 kills.');
  assert.equal(toks.map((t) => t.text).join(''), 'I have 300 kills.');
  const num = toks.find((t) => t.text === '300');
  assert.ok(num && num.type === 'word' && num.numeric === true);
});

test('tokenize: hyphens and ranges are not negative numbers', () => {
  // Al-Quaeda: two words, the hyphen is an "other" token, no numeric tokens.
  const al = tokenize('Al-Quaeda');
  assert.deepEqual(al.filter((t) => t.numeric).map((t) => t.text), []);
  // 3-5: two separate numbers, the hyphen is "other" (a range, not minus five).
  const range = tokenize('3-5');
  assert.deepEqual(range.filter((t) => t.numeric).map((t) => t.text), ['3', '5']);
  // A real leading minus is folded in as a sign.
  const neg = tokenize('it is -5 today');
  assert.ok(neg.some((t) => t.numeric && t.text === '-5'));
});

test('English numbers are spelled out and transliterated', () => {
  // 300 → "three hundred"; one number = one unit (no internal interpunct).
  assert.equal(transliterateTokens(phonemizeText('300', dict), 'chinese'), '斯里汉德拉德');
  assert.equal(transliterateTokens(phonemizeText('300', dict), 'katakana'), 'スリーハンドラド');
  // Fraction, ordinal, year.
  assert.equal(transliterateTokens(phonemizeText('1/2', dict), 'chinese'), '万海夫');
  assert.equal(transliterateTokens(phonemizeText('21st', dict), 'chinese'), '特文蒂佛斯特');
  assert.equal(transliterateTokens(phonemizeText('2019', dict), 'chinese'), '特文蒂南丁');
  // A number sits between words with the idiomatic interpunct.
  assert.equal(transliterateTokens(phonemizeText('over 300 kills', dict), 'chinese'),
    '欧佛·斯里汉德拉德·基勒兹');
});

test('no ASCII digits survive English forward output', () => {
  const out = transliterateTokens(
    phonemizeText('I have 300 kills and 21st place in 2019', dict), 'chinese');
  assert.doesNotMatch(out, /[0-9]/, out);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/engine.test.mjs`
Expected: FAIL — `tokenize` is not exported / not a function.

- [ ] **Step 3: Implement `tokenize` and rewrite `phonemizeText`**

In `public/src/phonemize.js`, update the imports at the top:

```js
import { arpabetToIpa } from './arpabet.js';
import { g2p as englishG2p } from './g2p.js';
import { ipaToArpabet } from './ipa2arpabet.js';
import { NUMBER_SRC, numberToWords, fractionToCommaDecimal } from './numbers.js';
```

Keep the existing `WORD_RE` (still used by `phonemizeTextEspeak` until Task 3) and add the shared tokenizer just below it:

```js
// Word source shared with the master tokenizer (same class as WORD_RE).
const WORD_SRC = "[A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿĀ-ž]+)*";
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
```

Replace the body of `phonemizeText` with:

```js
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
```

Note: `fractionToCommaDecimal` is imported now but first used in Task 3; that is fine (an unused import does not error). If your linter were strict you would add it in Task 3 instead — there is no lint step here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/engine.test.mjs`
Expected: PASS (existing golden tests still green; new number tests green).

- [ ] **Step 5: Commit**

```bash
git add public/src/phonemize.js test/engine.test.mjs
git commit -m "feat: tokenize numbers and spell them out in the English path"
```

---

### Task 3: numbers in the espeak path

**Files:**
- Modify: `public/src/phonemize.js` (rewrite `phonemizeTextEspeak` to use `tokenize`; remove the now-unused `WORD_RE`)
- Test: `test/languages.test.mjs` (stub-engine number test; real-WASM e2e for a European decimal and a fraction)

**Interfaces:**
- Consumes: `tokenize`, `fractionToCommaDecimal`, `ipaToArpabet`, injected `phonemizeLine`.
- Produces: `phonemizeTextEspeak` phonemizes numeric tokens individually (source `'number'`), decimalizing fractions first; word tokens keep the batched single-call + per-word fallback.

- [ ] **Step 1: Write the failing test**

In `test/languages.test.mjs`, add a stub test after the existing stub test (around line 50):

```js
test('phonemizeTextEspeak phonemizes number tokens individually', async () => {
  // Stub returns one IPA token ("tˈest") per whitespace-separated word.
  const phon = async (line) => line.split(' ').map(() => 'tˈest').join(' ');
  const tokens = await phonemizeTextEspeak('tengo 300', 'es', phon);
  const num = tokens.find((t) => t.text === '300');
  assert.ok(num, 'number token present');
  assert.equal(num.source, 'number');
  assert.ok(num.phonemes.length > 0, 'number token has phonemes');
});
```

And inside the real-WASM e2e test (`vendored espeak-ng phonemizes multiple languages end-to-end`), extend the `cases` array and add a digit-free assertion. Replace the `cases` array with:

```js
  const cases = [
    ['es', 'hola gracias'],
    ['fr', 'bonjour'],
    ['de', 'Straße'],
    ['it', 'ciao'],
    ['es', 'tengo 1,5 euros'], // European decimal comma → "uno coma cinco"
    ['de', 'media 1/2'],       // fraction → decimalized → "null komma fünf"
  ];
```

and add, inside that test's `for` loop after the existing `assert.ok(words.every(...))` lines:

```js
    for (const s of SCRIPTS) {
      const out = transliterateTokens(tokens, s.id);
      assert.doesNotMatch(out, /[0-9]/, `${text} -> ${s.id} still has digits`);
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/languages.test.mjs`
Expected: FAIL — the stub test sees `source` `'espeak'` (not `'number'`) and/or the e2e finds digits, because `phonemizeTextEspeak` does not yet handle numbers.

- [ ] **Step 3: Rewrite `phonemizeTextEspeak` and drop `WORD_RE`**

In `public/src/phonemize.js`, delete the old `WORD_RE` const (now unused — `tokenize` owns matching) and replace the whole body of `phonemizeTextEspeak` with:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/languages.test.mjs`
Expected: PASS (stub test sees `source: 'number'`; e2e outputs are digit-free). The WASM e2e is skipped automatically only if the binary is absent — it is present here.

- [ ] **Step 5: Commit**

```bash
git add public/src/phonemize.js test/languages.test.mjs
git commit -m "feat: pronounce numbers in the espeak path (incl. fractions/EU decimals)"
```

---

### Task 4: breakdown label + full-suite verification

**Files:**
- Modify: `public/app.js` (breakdown source-label map)
- Verify: whole suite

**Interfaces:**
- Consumes: `t.source === 'number'` produced by Tasks 2–3.
- Produces: the word-breakdown table shows `number` as the source for numeric tokens.

- [ ] **Step 1: Add the `number` source label**

In `public/app.js`, find the `srcLabel` map (around line 149) inside `renderForwardTokens`:

```js
    const srcLabel = { dict: 'dictionary', rule: 'rules', espeak: 'espeak-ng', none: 'unknown' }[t.source];
```

and change it to:

```js
    const srcLabel = { dict: 'dictionary', rule: 'rules', espeak: 'espeak-ng', number: 'number', none: 'unknown' }[t.source];
```

(This is browser-only glue with no node test; verify by reading the diff. With the entry missing, a numeric row's source cell would render `undefined`.)

- [ ] **Step 2: Run the whole test suite**

Run: `npm test`
Expected: PASS — all of `engine.test.mjs`, `romanize.test.mjs`, `numbers.test.mjs`, and `languages.test.mjs` green (no regressions in the existing golden tables).

- [ ] **Step 3: Manual smoke check (optional but recommended)**

Run: `npm start`, open `http://localhost:8000`, type `I have 300 kills in 2019 ($3.50, 1/2 off)` in forward mode with the Chinese script, and confirm the output is fully phonetic (no Latin digits) and the breakdown table labels the numeric rows `number`. Switch the source language to German and confirm `1,5` reads as a decimal.

- [ ] **Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: label number tokens in the word breakdown"
```

---

## Self-Review

**Spec coverage** (against `2026-06-19-numeral-handling-design.md`):
- §1 token model (`numeric` word tokens, `source:'number'`) → Task 2 `tokenize`, Tasks 2–3 phonemizers, Task 4 breakdown label.
- §2 `src/numbers.js` (`NUMBER_RE`, `numberToWords` full works, `fractionToCommaDecimal`) → Task 1.
- §3 data flow: dict path → Task 2; espeak path (individual calls, fraction decimalization) → Task 3.
- §4 shared `tokenize` → Task 2 (introduced), Task 3 (espeak adopts it, `WORD_RE` removed).
- §5 testing: `numbers.test.mjs` → Task 1; engine golden + no-digit invariant → Task 2; languages stub + WASM e2e (EU decimal, fraction) → Task 3.
- Year heuristic, ordinals, currency, percent, fractions, negatives, leading-zero, EU comma → Task 1 tests + impl.

**Placeholder scan:** none — every step has concrete code/commands/expected output.

**Type consistency:** `NUMBER_SRC` (string) composed into `TOKEN_RE`; `numberToWords`/`fractionToCommaDecimal` signatures identical across Tasks 1/2/3; token shape `{type, text, numeric, phonemes, ipa, source}` consistent; `source:'number'` produced in Tasks 2–3 and consumed in Task 4; golden values (`斯里汉德拉德`, `万海夫`, `特文蒂佛斯特`, `特文蒂南丁`) computed from the real engine.
