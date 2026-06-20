# Phonetic numeral handling (forward mode) — design

**Date:** 2026-06-19
**Status:** Approved (design)
**Scope:** Forward pipeline only (language → IPA/ARPABET → script). Romanize
direction is out of scope.

## Problem

In forward mode the tokenizer matches letter-runs only (`WORD_RE` in
`src/phonemize.js`), so digit-runs fall through as pass-through `other` tokens.
A numeral like `300` is never pronounced or transliterated — it appears verbatim
in the output (`…欧佛 300 坎芬德…`) instead of phonetically (`…欧佛·斯里·汉德拉德·坎芬德…`).

We want numerals to be **spoken** (spelled out) and then transliterated
phonetically into the target script, for **all 14 source languages**, covering
the **full range** of common numeric formats.

## Key finding that shapes the design

The forward pipeline has two pronunciation engines, and numbers land differently
in each:

- **espeak (the 13 non-English languages)** already expands numbers natively,
  in-language, with full coverage. Verified against the vendored WASM:
  - en voice: `300` → `θɹˈiːhˈʌndɹɪd` ("three hundred"); `1st` → `fˈɜːst`;
    `3.14` → "three point one four"
  - es voice: `300` → `tɾesθjˈentos` ("trescientos")
  - fr voice: `300` → `tʁwasˈɑ̃` ("trois cents")

  It simply never *receives* the digits today, because the tokenizer drops them
  before building the espeak input line. **Fix = stop dropping them.**

- **dict (English)** has no number knowledge at all, and its defining property is
  *instant, offline, zero-download*. Routing English numbers through espeak would
  force an 18.5 MB download mid-session the first time a user types a digit —
  breaking that promise. So **English needs its own number-to-words step.**

A second finding: multi-word expansions break espeak's one-token-one-IPA-word
alignment. `1999` → 3 IPA chunks, `3.14` → 4 chunks, while `300` stays 1 chunk.
`phonemizeTextEspeak` aligns IPA words to word tokens by whitespace, so a number
token that expands to multiple words would force the slow per-word fallback for
the whole line. The design phonemizes number tokens individually to avoid this.

## Chosen approach (Approach A)

Custom English number-to-words **plus** feed numeric tokens to espeak for the
other 13 languages. English stays instant/offline; non-English gets idiomatic,
native expansion for free. English and espeak may differ slightly in *style*
(e.g. British espeak's "three hundred **and** five") — acceptable, each is
natural for its engine.

Rejected:
- **Approach B** (route *all* numbers, incl. English, through espeak): breaks the
  English instant/offline promise; mixed dependency.
- **Approach C** (integers only): under-delivers vs the chosen "full works" scope.

## Design

### §1 Token model

Number tokens become first-class **word-like** tokens:
`{ type: 'word', text: <original>, numeric: true, phonemes, ipa, source: 'number' }`.

Because they are `type: 'word'` with real phonemes, the rest of the pipeline
treats them like any other word with **no changes**:
- `transliterateTokens` transliterates them (it only acts on `type === 'word'`).
- The interpunct/nakaguro word-separator logic joins a number to adjacent words
  (`欧佛·斯里·汉德拉德·坎芬德`), matching the styling for words. *(Approved styling
  choice: numbers participate in the `·`/`・` separator like words.)*
- The IPA row and the breakdown table render them.

The only `app.js` change: add `number: 'number'` to the breakdown source-label map.

### §2 New module `src/numbers.js`

Pure, isolated, independently testable. The only substantial new code.

Exports:

- **`NUMBER_RE`** — matches composite numeric forms *intact* so espeak receives
  the whole unit (`$300`, `1st`, `3.14`, `50%`, `1,000`):
  - optional leading minus (conservative — Unicode negative-lookbehind so
    `Al-Quaeda`, `3-5` ranges, and `well-known` are not misread as negatives)
  - optional currency symbol: `$ £ € ¥`
  - digit core: `\d` with optional `,` grouping and optional `.` decimal
  - optional trailing `%` **or** ordinal suffix (`st|nd|rd|th`)

- **`numberToWords(token)`** → lowercase, space-separated **English** words
  (space-separated, no hyphens, so phonemizing is a trivial `split(' ')`):
  - **cardinals** to trillions; beyond 10¹⁵ → digit-by-digit
  - **decimals**: `3.14` → "three point one four" (fractional part read
    digit-by-digit; `0` → "zero")
  - **negatives**: "minus …"
  - **comma** thousands-separators stripped (US convention: comma = grouping,
    dot = decimal)
  - **years** (heuristic, bare 4-digit `1100`–`2099`, no currency/%/ordinal/
    decimal/sign): pair reading — `1999` → "nineteen ninety nine",
    `1905` → "nineteen oh five", `1900` → "nineteen hundred",
    `2000` → "two thousand", `2005` → "two thousand five",
    `2019` → "twenty nineteen"
  - **ordinals**: `1st` → "first", `21st` → "twenty first"
  - **currency**: `$300` → "three hundred dollars", `$3.50` → "three dollars and
    fifty cents", `$1` → "one dollar" ( `$`→dollar, `£`→pound, `€`→euro, `¥`→yen )
  - **percent**: `50%` → "fifty percent"
  - **leading-zero** runs (`007`, `00`) → digit-by-digit ("zero zero seven")

### §3 Data flow per engine

- **dict (English)** — numeric token → `numberToWords` → `split(' ')` →
  phonemize each sub-word via existing dict/g2p → concatenate into one phoneme
  array → `ipa = arpabetToIpa(...)`, `source = 'number'`. No espeak load. One
  number = one transliterated unit (no internal `·`).

- **espeak (13 langs)** — numeric token → its **own**
  `phonemizeLine(originalText, voice)` call (espeak expands it natively). Word
  tokens keep the existing single batched call + per-word fallback. Phonemizing
  numbers individually sidesteps the alignment break without forcing the whole
  line onto the slow path. Reuses the injected `phonemizeLine` — no new espeak
  plumbing. `source = 'number'`.

### §4 Shared tokenizer

Factor the duplicated `WORD_RE` loop in `phonemizeText` and
`phonemizeTextEspeak` into one `tokenize(text)` returning
`{ type: 'word'|'other', text, numeric }` tokens. A master regex alternates
`NUMBER | WORD`; gaps between matches become `other` tokens. NUMBER precedes WORD
in the alternation so `300` is one number, while `Al-Quaeda` → `Al` / `-` / `Quaeda`.
Both engines then only fill in phonemes. Targeted dedup of code we are already
touching.

### §5 Testing

- **`test/numbers.test.mjs`** (new): exhaustive `numberToWords` + `NUMBER_RE`
  unit tests — every format, year boundaries (1099/1100/2099/2100), negatives,
  leading zeros, currency with/without cents, ordinals, percent, and
  false-positives (`Al-Quaeda`, `3-5`, `well-known`).
- **`test/engine.test.mjs`**: add golden number cases (e.g. `300` → Chinese) and
  an invariant — English forward output of numeric text contains **no ASCII
  digits**.
- **`test/languages.test.mjs`**: extend the real-WASM e2e to assert a non-English
  number expands (output non-empty, no leftover digits). Skipped when WASM absent.

### §6 Out of scope (YAGNI)

- Romanize mode (reverse direction)
- European decimal comma (`1,5`)
- Fractions (`1/2`)
- Time / phone-number digit grouping beyond the leading-zero rule

## Edge-case decisions (recorded)

- **Minus** is only a sign when directly attached to digits and not preceded by a
  letter/digit; otherwise it stays an `other` token (hyphen/range).
- **`1,5`** is read US-style as `15` (comma = grouping). Documented limitation.
- **Numbers > 10¹⁵** read digit-by-digit (no scale-word gaps).
- **`0`** → "zero"; leading-zero runs read digit-by-digit.
- **Ordinal suffix** attaches only to integers; a stray suffix after a decimal is
  not consumed by `NUMBER_RE`.
- A numeric token that somehow fails to expand falls back to its original text
  (current behavior for unpronounceable tokens), so output never regresses to a
  crash.

## Files touched

- `src/numbers.js` — **new** (`NUMBER_RE`, `numberToWords`)
- `src/phonemize.js` — shared `tokenize`, numeric handling in both engines
- `public/app.js` — breakdown source-label map gains `number`
- `test/numbers.test.mjs` — **new**
- `test/engine.test.mjs`, `test/languages.test.mjs` — added cases/invariants
