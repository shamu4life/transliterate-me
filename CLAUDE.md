# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Transliterate Me is a **phonetic** transliteration tool: it reproduces how text
*sounds*, not its meaning, in two directions:

- **Forward** — a Latin-script language (14 supported) → IPA pronunciation →
  a world script (Katakana, Hangul, Cyrillic, Greek, Arabic, Hebrew, Chinese).
- **Romanize** — any of those world scripts → the Latin alphabet.

The entire pipeline runs **client-side in the browser** as ES modules + vendored
JS/WASM. There is no backend, no build step, and no external API calls. `public/`
*is* the deployed site; everything else is dev tooling.

## Commands

```bash
npm start          # serve public/ at http://localhost:8000 (zero-dependency Node static server)
npm test           # run the whole suite (node --test, no deps)
./vendor.sh        # one-time: fetch the two large binaries omitted from the slim archive
```

Run a single test file or a single test by name:

```bash
node --test test/engine.test.mjs
node --test --test-name-pattern='transliterate "hello"'
```

There is no lint step and no dependencies to install (`package.json` has no
`dependencies`). A static HTTP server is required because the app loads ES
modules and the CMU dictionary via `fetch()` — opening `index.html` as
`file://` will not work.

### vendor.sh — required for full functionality

Two large binaries (~36 MB) are **omitted from the slim archive** and must be
fetched once with `./vendor.sh` (needs Node/npm) before they work:

- `public/vendor/espeak/espeak-ng.wasm` — needed for the 13 non-English source
  languages.
- `public/vendor/kuromoji-dict/*.dat.gz` — needed for Japanese kanji→romaji.

Everything else (English forward, all romanizers except JP kanji, the matching
JS glue/bundles) runs as-is without vendoring. The `engine.test.mjs` and
`romanize.test.mjs` suites do **not** need the vendored binaries;
`languages.test.mjs` has an end-to-end test against the real espeak WASM that is
skipped if it is absent.

## Architecture

Both directions share a common shape: text is tokenized (words vs.
whitespace/punctuation, which passes through unchanged), each word is converted,
and results are rejoined preserving the original layout.

### Forward pipeline: language → IPA/ARPABET → script

```
text → pronunciation → ARPABET phonemes → target script
```

1. **Text → pronunciation.** Two engines, chosen per source language in
   `src/lang/index.js`:
   - **English** (`engine: 'dict'`) — looked up in the bundled CMU Pronouncing
     Dictionary (`data/cmudict.txt`, parsed by `src/dict.js`) with a rule-based
     g2p fallback (`src/g2p.js`) for unknown words. Instant, offline.
   - **Other 13 languages** (`engine: 'espeak'`) — phonemized to IPA by the
     vendored espeak-ng WASM (`src/lang/espeak.js`), lazy-loaded on first use.
2. **Normalize to ARPABET.** Everything downstream operates on **ARPABET**
   phoneme arrays. English ARPABET is rendered to IPA only for display
   (`src/arpabet.js`); espeak's IPA is mapped to the nearest ARPABET
   (`src/ipa2arpabet.js`). Sounds outside ARPABET collapse to the closest
   phoneme, but **vowel length survives as a `ː` token** so e.g. Katakana can
   add a chōonpu.
3. **ARPABET → script.** `src/transliterate.js` is the dispatcher: the `SCRIPTS`
   registry maps each script `id` to a `fn` in `src/scripts/*.js`. Each script
   module turns a phoneme array into that writing system, handling its own
   quirks (Japanese epenthetic vowels/mora, Hangul jamo syllable-block
   composition, abjad vowel diacritics, etc.).

The token shape from `phonemizeText` (English) and `phonemizeTextEspeak`
(others) in `src/phonemize.js` is identical, so the rest of the UI is engine-agnostic.

### Romanize pipeline: script → Latin

`src/romanize/index.js` is the dispatcher. It walks the input, classifies each
character by Unicode range (`src/romanize/detect.js`), groups consecutive
same-script runs, and routes each run to a romanizer (`pinyin.js`, `kana.js`,
`hangul2rr.js`, `alphabets.js`). Key subtleties:

- **`romanizeText` is async** because Japanese romanization (kuroshiro) is async.
- **Han disambiguation.** Han characters are shared between Chinese and Japanese
  and can't be told apart by Unicode alone. If kana is present the text is
  treated as Japanese (`isJapanese`); an explicit `source` overrides the guess.
  In Japanese mode, kanji+kana runs are romanized *together* via kuroshiro so
  readings/particles resolve in context (私は → watashi wa).
- Chinese uses vendored **pinyin-pro** (context-aware polyphones); Japanese uses
  vendored **kuroshiro + kuromoji**. Both are injected as `opts` by the app and
  lazy-loaded.

### Front-end wiring

`public/app.js` is the only UI glue and drives both modes (tabs). It owns DOM
state, builds the script/source choosers from the `SCRIPTS`/`SOURCES`/`LANGUAGES`
registries, loads the CMU dictionary up front, and lazy-loads espeak / pinyin-pro
/ kuroshiro on demand. Async renders are guarded by a monotonic token counter to
avoid out-of-order updates while typing.

## Conventions

- **Plain ES modules, no framework, no transpiler.** Source files are served to
  the browser verbatim from `public/src/`; tests import the same files directly.
  Keep them runnable both in the browser and under `node --test` — no
  bundler-only syntax, no `node_modules` imports in `public/`.
- **Registries are the extension points.** To add a target script, add a module
  in `src/scripts/` and an entry to `SCRIPTS` in `transliterate.js`. To add a
  source language, add to `LANGUAGES` in `src/lang/index.js`. To add a romanizer,
  add to `SOURCES` + the `fns` map in `romanize/index.js` and the Unicode range
  in `detect.js`. The UI reads from these registries automatically.
- **`quality` fields are honest signals** (`good`/`fair`/`rough`), surfaced in
  the UI — set them accurately for new scripts.
- **Golden-output tests pin behavior.** `test/engine.test.mjs` has a `GOLDEN`
  table of expected per-script outputs; mapping tweaks that change them must
  update the table intentionally. There are also invariants (every ARPABET
  consonant must produce non-empty output in every script; Chinese output must
  contain no Latin pinyin leakage) — keep these green when editing mappings.

## Deploy

Fully static, no build step. `public/` is published as-is:

- **Cloudflare Workers** (connected integration) — `wrangler.toml` is a Workers
  *static assets* config (no Worker script); Cloudflare serves `public/`
  directly. Workers Builds runs `wrangler deploy` on each push; manual:
  `npx wrangler deploy`.
- **GitHub Pages** — `.github/workflows/deploy.yml` runs `npm test`, then
  publishes `public/` on every push to `main`.

## License note

GPL-3.0-or-later, because the bundled espeak-ng (`public/vendor/espeak/`) is
GPL-3.0. Other vendored components keep their own permissive licenses
(CMU dict BSD-2, pinyin-pro / kuroshiro / kuromoji MIT). Keep license notices
intact when touching `public/vendor/`.
