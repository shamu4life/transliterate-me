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
the **full range** of common numeric formats — including **fractions** and
**European number formatting** (comma decimal, dot/`.` grouping), since most of
the source languages are continental-European.

## Key findings (verified against the vendored espeak-ng WASM)

The forward pipeline has two pronunciation engines, and numbers land differently
in each.

1. **espeak (the 13 non-English languages) expands numbers natively, in-language,
   per-locale — for free.** It simply never *receives* the digits today, because
   the tokenizer drops them before building the espeak line. Fix = stop dropping
   them.
   - `300`: en→"three hundred", es→"trescientos", fr→"trois cents"
   - Ordinals/decimals/currency/percent all handled by the en voice
     (`1st`→"first", `3.14`→"three point one four").

2. **espeak interprets the decimal comma and dot-grouping per voice** — so
   European formatting needs **no expansion code of ours**, only intact tokens:
   - `1,5`: de→"eins komma fünf", fr→"un virgule cinq", es→"uno coma cinco"
   - `1.000`: de→"ein tausend", fr→"mil"; `1.000,50`: fr→"mil virgule cinquante"
   - All 13 espeak voices read comma-decimal `0,5` as a decimal value.
   - **All 13 espeak languages are comma-decimal** (continental European +
     Turkish); none use dot-decimal.

3. **dict (English) has no number knowledge**, and its defining property is
   *instant, offline, zero-download*. Routing English numbers through espeak
   would force an 18.5 MB download the first time a user types a digit. So
   **English needs its own number-to-words step**, using **US convention** (dot
   decimal, comma grouping) — correct for English text.

4. **espeak does NOT handle fractions in any language** — it reads the slash
   literally or drops it:
   - `1/2`: en→"one **slash** two", de→"eins zwei", fr→"un deux"

   So fractions cannot lean on espeak. We handle them ourselves:
   - **English**: idiomatic, in `numberToWords` (`1/2`→"one half").
   - **13 espeak languages**: **decimalize** `a/b` → value, round, format with a
     **comma**, and let espeak read it in-language (verified: de `3,142857`→"drei
     komma eins vier …"). Read as the decimal *value*, not idiomatic fraction
     phrasing — an accepted espeak limitation.

5. Multi-word expansions break espeak's one-token-one-IPA-word alignment
   (`1999`→3 chunks, `3.14`→4). `phonemizeTextEspeak` aligns by whitespace, so a
   number token would force the slow per-word fallback for the whole line. The
   design phonemizes number tokens **individually** to avoid this.

## Chosen approach (Approach A)

Custom English number-to-words **plus** feed numeric tokens to espeak for the
other 13 languages. English stays instant/offline; non-English gets idiomatic,
native expansion (including European formatting) for free. English and espeak
may differ slightly in *style* (e.g. British espeak's "three hundred **and**
five") — acceptable, each is natural for its engine.

Rejected: **B** (route all numbers incl. English through espeak — breaks the
English instant/offline promise); **C** (integers only — under-delivers).

## Design

### §1 Token model

Number tokens become first-class **word-like** tokens:
`{ type: 'word', text: <original>, numeric: true, phonemes, ipa, source: 'number' }`.

Because they are `type: 'word'` with real phonemes, the rest of the pipeline
treats them like any other word with **no changes**:
- `transliterateTokens` transliterates them (it only acts on `type === 'word'`).
- The interpunct/nakaguro word-separator joins a number to adjacent words
  (`欧佛·斯里·汉德拉德·坎芬德`). *(Approved styling: numbers participate in `·`/`・`.)*
- The IPA row and the breakdown table render them.

The only `app.js` change: add `number: 'number'` to the breakdown source-label map.

### §2 New module `src/numbers.js`

Pure, isolated, independently testable. The only substantial new code. Exports:

- **`NUMBER_RE`** — matches composite numeric forms *intact* so espeak receives
  the whole unit:
  - optional leading minus (conservative — Unicode negative-lookbehind so
    `Al-Quaeda`, `3-5` ranges, `well-known` are not misread as negatives)
  - optional currency symbol: `$ £ € ¥` (prefix position)
  - one of: a **fraction** `\d+/\d+`, or a **number core** `\d+(?:[.,]\d+)*`
    (captures both `1,000,000.50` and `1.000.000,50`, plus `3.14`, `1,5`,
    `1.000`, `300`). Grouping/decimal separators are `.` and `,` only — never
    whitespace, so `300 confirmed` is not merged. A trailing sentence period is
    not consumed (`300.` → `300` + `.`), because a separator must be followed by
    a digit.
  - optional trailing `%` **or** ordinal suffix (`st|nd|rd|th`)

- **`numberToWords(token)`** → lowercase, space-separated **English** words
  (US convention; no hyphens, so phonemizing is a trivial `split(' ')`):
  - **cardinals** to trillions; beyond 10¹⁵ → digit-by-digit
  - **decimals**: `3.14`→"three point one four" (fractional part digit-by-digit;
    `0`→"zero")
  - **negatives**: "minus …"
  - **comma** thousands-separators stripped; dot = decimal (US)
  - **years** (heuristic, bare 4-digit `1100`–`2099`, no currency/%/ordinal/
    decimal/sign): `1999`→"nineteen ninety nine", `1905`→"nineteen oh five",
    `1900`→"nineteen hundred", `2000`→"two thousand", `2005`→"two thousand five",
    `2019`→"twenty nineteen"
  - **ordinals**: `1st`→"first", `21st`→"twenty first"
  - **currency**: `$300`→"three hundred dollars", `$3.50`→"three dollars and
    fifty cents", `$1`→"one dollar" (`$`→dollar, `£`→pound, `€`→euro, `¥`→yen)
  - **percent**: `50%`→"fifty percent"
  - **fractions** (idiomatic): numerator cardinal + denominator name,
    pluralized when numerator ≠ 1. Denominator 2→"half/halves", 4→"quarter(s)",
    else ordinal(+"s"): `1/2`→"one half", `3/4`→"three quarters",
    `2/3`→"two thirds", `22/7`→"twenty two sevenths", `1/100`→"one hundredth".
    `a/1`→ just the integer; `a/0` → fall back to original text.
  - **leading-zero** runs (`007`, `00`) → digit-by-digit ("zero zero seven")

- **`fractionToCommaDecimal(token)`** → for the espeak path: convert `a/b` to a
  comma-decimal value string (rounded to 6 decimals, trailing zeros trimmed),
  e.g. `1/2`→`"0,5"`, `22/7`→`"3,142857"`. Returns `null` for non-fractions /
  `b===0` (caller then sends the original token).

### §3 Data flow per engine

- **dict (English)** — numeric token → `numberToWords` → `split(' ')` →
  phonemize each sub-word via existing dict/g2p → concatenate into one phoneme
  array → `ipa = arpabetToIpa(...)`, `source = 'number'`. No espeak load. One
  number = one transliterated unit (no internal `·`).

- **espeak (13 langs)** — numeric token → if it is a fraction, pre-normalize via
  `fractionToCommaDecimal`; otherwise send the original text intact (espeak
  applies the voice's locale rules for comma/dot/ordinal/currency/percent). Then
  its **own** `phonemizeLine(send, voice)` call (individually, to sidestep the
  alignment break). Word tokens keep the existing single batched call + per-word
  fallback. Reuses the injected `phonemizeLine` — no new espeak plumbing.
  `source = 'number'`.

### §4 Shared tokenizer

Factor the duplicated `WORD_RE` loop in `phonemizeText` and
`phonemizeTextEspeak` into one `tokenize(text)` returning
`{ type: 'word'|'other', text, numeric }` tokens. A master regex alternates
`NUMBER | WORD`; gaps become `other`. NUMBER precedes WORD so `300` is one
number while `Al-Quaeda` → `Al` / `-` / `Quaeda`. Both engines then only fill in
phonemes. Targeted dedup of code we are already touching.

### §5 Testing

- **`test/numbers.test.mjs`** (new): exhaustive `numberToWords`, `NUMBER_RE`, and
  `fractionToCommaDecimal` unit tests — every format, year boundaries
  (1099/1100/2099/2100), negatives, leading zeros, currency with/without cents,
  ordinals, percent, fractions (incl. `/2`,`/4`, plurals, `a/1`, `a/0`),
  US/EU-grouped numbers, and false-positives (`Al-Quaeda`, `3-5`, `well-known`).
- **`test/engine.test.mjs`**: golden number cases (e.g. `300`→Chinese, a
  fraction → English) + invariant: English forward output of numeric text
  contains **no ASCII digits**.
- **`test/languages.test.mjs`**: extend the real-WASM e2e to assert (a) a
  non-English number expands and (b) a European-formatted decimal `1,5` and a
  fraction read as a decimal — output non-empty, no leftover digits. Skipped when
  WASM absent.

### §6 Out of scope (YAGNI)

- Romanize mode (reverse direction)
- Mixed numbers (`1 1/2` → read as `1` then `1/2`, not "one and a half")
- Suffix-position currency (`300€` → `€` passes through as `other`)
- Written European ordinals (German `1.` = "erste") — the dot is punctuation
- Whitespace thousands grouping (`1 000`)

## Edge-case decisions (recorded)

- **Locale split**: English = US convention (our `numberToWords`); the 13 espeak
  languages = each voice's locale (espeak), all comma-decimal. The tokenizer is
  locale-agnostic and captures the superset of formats; interpretation is
  downstream.
- **Minus** is a sign only when directly attached to digits and not preceded by a
  letter/digit; otherwise it stays `other` (hyphen/range).
- **Fractions**: idiomatic for English; decimalized (comma, rounded 6 dp) for
  espeak languages; `a/0` and other degenerate forms fall back to original text.
- **Numbers > 10¹⁵** read digit-by-digit; `0`→"zero"; leading-zero runs
  digit-by-digit.
- A numeric token that fails to expand falls back to its original text (current
  behavior for unpronounceable tokens), so output never regresses to a crash.

## Files touched

- `src/numbers.js` — **new** (`NUMBER_RE`, `numberToWords`, `fractionToCommaDecimal`)
- `src/phonemize.js` — shared `tokenize`, numeric handling in both engines
- `public/app.js` — breakdown source-label map gains `number`
- `test/numbers.test.mjs` — **new**
- `test/engine.test.mjs`, `test/languages.test.mjs` — added cases/invariants
