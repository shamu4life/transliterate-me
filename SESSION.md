# Session Handoff & Transcript — Transliterate Me

> **Provenance:** This document was written by Claude, reconstructed from the
> working session that produced this project. It is a faithful narrative +
> decision log, not a byte-verbatim chat export. Load it into a new instance to
> resume work with full context.

---

## 0. TL;DR for a new instance

**Transliterate Me** is a fully client-side, static web app that moves text
between writing systems *by sound*, in two directions:

- **Forward:** type a Latin-script language (14 supported) → see its **IPA** →
  transliterate the *sound* into Japanese (Katakana), Korean (Hangul), Russian
  (Cyrillic), Greek, Arabic, Hebrew, or (approximately) Chinese.
- **Reverse (romanize):** paste Chinese / Japanese / Korean / Russian / Greek /
  Arabic / Hebrew → get it back in the **Latin alphabet**.

No backend, no external APIs. All NLP runs in the browser via vendored JS/WASM.
Deployed as static assets (Cloudflare Workers static-assets + a GitHub Pages
workflow). **License: GPL-3.0-or-later** (because espeak-ng is bundled).

**Status:** feature-complete and working; 33 tests pass (`npm test`). The
original repo/PR was abandoned (wrong account) and the project was exported to a
clean, Claude-attributed archive for a new repo.

---

## 1. What the user asked for (chronological narrative)

1. **Initial request.** "A simple website: input Latin/English text → on the
   backend turn it into IPA → let the user pick an output alphabet (Japanese,
   Chinese, Korean…) to transliterate to."

2. **Clarifying Q&A.** Output scripts chosen: Japanese Katakana, Korean Hangul,
   Russian Cyrillic, Chinese (approximate), **plus Greek, Arabic, Hebrew**. IPA
   engine: **dictionary-based**. Stack: "whatever makes sense to run on GitHub
   workers" (later clarified to mean **Cloudflare Workers**; user has the paid
   plan).

3. **v1 built.** Static site: English→ARPABET via the CMU Pronouncing
   Dictionary (+ rule fallback) → IPA → per-script transliterators. Frontend,
   zero-dep dev server, tests, GitHub Pages workflow. PR #1 opened.

4. **CI surprise.** The repo was wired to **Cloudflare Workers Builds**, which
   failed (no wrangler config). Fixed by adding `wrangler.toml` (static-assets)
   and moving the published site into `public/` so the deploy ships only site
   files. Went green.

5. **Reverse direction.** User asked: "what if I have Chinese and want it in the
   English alphabet, with accents?" → chose **All scripts → Latin**. Built the
   romanize engine + a two-tab UI.

6. **"Does a container backend make sense for speed?"** → No. The pipeline is
   hash-map/table lookups (sub-ms); client-side is *faster* (no per-keystroke
   round-trip) and free to host. A backend only helps *capability*, not latency.

7. **Other Latin languages.** User noticed English-only handling mangles
   Spanish/French/Polish. Chose all four (es/pl/de/fr). Built rule-based G2P
   modules. (Also fixed a latent crash: Hangul threw on the `ʒ`/ZH phoneme;
   Katakana dropped medial `ŋ`.)

8. **"Make the rough stuff work without an API."** → Chose **client-side
   JS/WASM libraries**, all priorities. Delivered in stages:
   - **Stage 1 — Chinese polyphones:** vendored `pinyin-pro` (phrase-aware).
   - **Stage 2 — Japanese kanji→romaji:** vendored `kuroshiro` + kuromoji
     (~18 MB dict, lazy-loaded).
   - **Stage 3 — unified G2P + more languages:** vendored `espeak-ng` (WASM),
     replacing the hand-written es/pl/de/fr rules and adding 13 languages. Since
     espeak-ng is **GPL-3.0**, the user agreed to **relicense the whole project
     to GPL-3.0**.

9. **Quality assessment** requested and given (see §4).

10. **Improve the "rough" items.** Chose all three: (a) rewrite Chinese-as-target
    to emit valid syllables + character table; (b) Arabic/Hebrew romanize vowel
    heuristics + diacritics; (c) forward→Arabic/Hebrew output diacritics. All
    implemented.

11. **Mobile bug.** Both mode panels rendered at once — `main { display: grid }`
    overrode the `[hidden]` attribute. Fixed with `[hidden]{display:none!important}`.

12. **Account migration.** User realized the wrong GitHub account was used.
    Requested a clean export (no `rob-paprocki`, attributed to Claude). The full
    51 MB archive wouldn't download; produced a **1.2 MB slim zip** (everything
    except the two big binaries) + `vendor.sh` to re-fetch them. PR #1 was then
    closed.

13. **This document.** User asked for an archive with the code **and** a chat
    transcript to load into a new instance.

---

## 2. How it works (pipeline)

### Forward: Latin language → world script
```
text → pronunciation → IPA → ARPABET phonemes → target-script transliterator
       ▲                                  ▲
  English: CMU dict (+ rule g2p)     per-script mapping (src/scripts/*.js)
  others:  espeak-ng WASM → IPA → src/ipa2arpabet.js (nearest ARPABET)
```
- English stays on the CMU dictionary (instant, offline, high quality).
- The other 13 languages use espeak-ng (one WASM engine, lazy-loaded ~18.5 MB).
- `ipa2arpabet.js` maps espeak IPA → ARPABET so all 7 transliterators are reused
  unchanged. **Vowel length is preserved** as a `ː` token → Katakana adds ー.

### Reverse: world script → Latin
```
text → detect script per run (Unicode range) → per-script romanizer
```
- Chinese → `pinyin-pro` (polyphone-aware, tone marks/numbers).
- Japanese → `kuroshiro` + kuromoji (kanji+kana Hepburn). Han+kana run goes to
  kuroshiro together so particles resolve (私は → "watashi wa").
- Han is shared between zh/ja → disambiguated by context (kana present ⇒ Japanese)
  or an explicit picker.
- Korean → Revised Romanization with cross-syllable sound-change rules.
- Cyrillic/Greek/Arabic/Hebrew → letter tables (Arabic/Hebrew are position-aware
  for matres lectionis + niqqud/harakat).

---

## 3. File map
```
public/
  index.html, styles.css, app.js     UI (two modes); app.js is the glue
  data/cmudict.txt                   CMU dict (English pronunciations)
  vendor/
    pinyin-pro.mjs                   Chinese pinyin (MIT)
    kuroshiro.bundle.mjs             Japanese romaji glue (MIT)  [needs kuromoji-dict/]
    kuromoji-dict/*.dat.gz           ~18 MB  [excluded from slim archive — run vendor.sh]
    espeak/espeak-ng.js              espeak glue (GPL-3.0)
    espeak/espeak-ng.wasm            ~18.5 MB  [excluded from slim archive — run vendor.sh]
  src/
    arpabet.js                       ARPABET → IPA (English)
    ipa2arpabet.js                   espeak IPA → ARPABET (+ length token)
    g2p.js                           rule fallback for unknown English words
    dict.js, phonemize.js            dict parsing; text → tokens (+ espeak variant)
    transliterate.js                 forward script registry/dispatcher
    scripts/*.js                     one forward transliterator per output script
    lang/
      index.js                       source-language registry (en=dict, rest=espeak)
      espeak.js                      espeak-ng WASM wrapper (lazy, memoised)
    romanize/
      detect.js                      script detection by Unicode range
      index.js                       romanize dispatcher (async; zh/ja split)
      pinyin.js, kana.js, hangul2rr.js, alphabets.js
server.mjs                           zero-dep static dev server (npm start)
wrangler.toml                        Cloudflare Workers (static assets) config
.github/workflows/deploy.yml         test + GitHub Pages deploy
test/*.test.mjs                      33 tests (both directions; real WASM e2e)
vendor.sh                            re-fetch espeak-ng.wasm + kuromoji dict
```

---

## 4. Honest quality assessment (per script pair)

**Reverse (script → Latin):**
- Chinese → Pinyin: **excellent** (pinyin-pro; polyphone-aware).
- Japanese → Romaji: **very good** (kuromoji; kanji + particles).
- Korean → Revised: **good** (now applies liaison, ㄴ/ㄹ→ll, nasalisation,
  ㅎ-aspiration; some rare rules still unhandled).
- Russian/Greek → Latin: **good**.
- Arabic/Hebrew → Latin: **fair** — matres read as vowels (שלום→shlom), niqqud/
  harakat applied when present (שָׁלוֹם→shalom); **unwritten short vowels in
  unvocalized text are unrecoverable** without an ML diacritizer (hard ceiling).

**Forward (Latin → script):**
- Pronunciation step is now genuinely good (CMU for English, espeak for the rest).
- Japanese Katakana / Korean Hangul: **good**.
- Russian Cyrillic: **good/fair**. Greek: **fair**.
- Arabic/Hebrew: **fair** — short vowels now written as harakat/niqqud.
- Chinese: **fair** — rewritten to emit only valid Mandarin syllables mapped to
  conventional characters (Smith→斯米斯, world→沃勒德); character choices won't
  always match the official Xinhua 译音表.

**Conceptual ceiling:** this is *phonetic* transliteration ("how it sounds in
script X"), not established-loanword orthography. So コーヒー (real) vs カフィー
(our phonetic) for "coffee" — both legitimate, different goals.

---

## 5. Key decisions & rationale
- **Client-side, not a backend.** All lookups; client-side is faster + free.
  Paid Cloudflare/containers only justified for heavy NLP — which we instead
  solved with vendored WASM/JS.
- **Vendoring (not a CDN).** Library builds live in `public/vendor/` so the app
  stays self-hosted/offline (no external runtime dependency).
- **English on CMU dict, others on espeak.** English is instant + offline +
  highest quality; espeak unifies the rest and adds languages, lazy-loaded.
- **ARPABET as the internal lingua franca.** Lets all 7 transliterators be reused
  for every source language. Cost: some IPA detail collapses (mitigated for
  vowel length → Katakana ー).
- **GPL-3.0.** espeak-ng is GPL; bundling it makes the whole distribution GPL.
  User chose to relicense rather than drop espeak.

---

## 6. Known limitations & possible next steps
- **Unvocalized Arabic/Hebrew short vowels** — needs an ML diacritizer (heavy);
  intentionally not done.
- **Chinese character choices** — could match the official Xinhua table more
  closely with a fuller, verified syllable→character dataset.
- **Korean RR** — a few rarer assimilation/palatalisation rules unhandled.
- **IPA → ARPABET collapse** — could go further (front-rounded vowels ø/y, nasal
  vowels) for Katakana/Hangul if desired.
- **Repo size** — ~36 MB of vendored binaries; that's the cost of fully offline,
  no-API NLP.

---

## 7. Run / deploy / vendor
```bash
./vendor.sh          # fetch espeak-ng.wasm + kuromoji dict (needed once)
npm test             # 33 tests, both directions
npm start            # http://localhost:8000
```
Deploy: static assets. `wrangler deploy` (Cloudflare) or the GitHub Pages
workflow (Settings → Pages → Source: GitHub Actions). Connect deploys to the new
repo/account.

---

## 8. Migration note
Original repo/PR (`rob-paprocki/transliterate-me` #1) was the wrong account and
is now closed. This archive is scrubbed of that name (including a coincidental
`paprocki` entry in the CMU dict) and is attributed to Claude. To start fresh:
init a new git repo with Claude as author, add the new remote, push. Do **not**
reopen the old PR.
