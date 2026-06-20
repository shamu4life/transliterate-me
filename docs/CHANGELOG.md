# Changelog

All notable changes to Transliterate Me are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- Forward — **numerals are now spoken, not dropped.** Digits in the input are
  spelled out and transliterated phonetically, in **all 14 source languages**;
  previously a number passed straight through as raw text.
- Forward — broad numeric coverage: **integers, decimals, negatives**, both
  **US (`1,000.50`) and European (`1.000,50`) grouping**, **years** (read
  idiomatically — *nineteen ninety-nine*), **ordinals** (`1st`, `2nd`, …),
  **currency** (`$ £ € ¥`, with yen invariant — *500 yen*, not *500 yens*),
  **percent**, and **fractions** (`1/2` → *one half*). The European decimal
  comma is handled by espeak for the non-English languages.
- Internal — new pure, dependency-free module **`src/numbers.js`**
  (`numberToWords`, `NUMBER_SRC`, `fractionToCommaDecimal`). English expands
  numbers via `numberToWords`; the 13 espeak languages send numeric tokens to
  espeak for native per-voice expansion (fractions are decimalized first because
  espeak reads a slash literally).

---

## [1.0.0] — 2026-06-19

Initial public release. Move text between writing systems **by its sound**, in
two directions — entirely in your browser, with no backend, no build step, and
no external API calls.

### Added
- Forward — type a **Latin-script source language** (14 supported: English,
  Spanish, French, German, Italian, Portuguese, Dutch, Polish, Catalan,
  Romanian, Czech, Swedish, Danish, Turkish), see its **IPA pronunciation**, and
  transliterate the *sound* into one of **7 world scripts**: Japanese Katakana,
  Korean Hangul, Russian Cyrillic, Greek, Arabic, Hebrew, or (approximately)
  Chinese.
- Forward — **English** is pronounced from the bundled CMU Pronouncing
  Dictionary (with a rule-based fallback for unknown words) — instant and
  offline; the **other 13 languages** are phonemized by the vendored espeak-ng
  WASM engine, loaded on demand on first non-English use.
- Romanize — paste any of those 7 world scripts and **romanize** it back into the
  Latin alphabet: Chinese → Pīnyīn with tone marks (context-aware polyphones via
  pinyin-pro), Japanese → Hepburn romaji (full kanji + kana via kuroshiro +
  kuromoji), Korean → Revised Romanization, plus practical transliteration for
  Cyrillic, Greek, Arabic, and Hebrew.
- UI — a **two-tab** client-side app (Forward and Romanize) that picks the source
  language and target script for you, shows the IPA along the way, and updates as
  you type.
- Privacy — runs **100% client-side**: no backend, no build step, and no external
  API calls. Dictionaries and engines load once and are cached; nothing you type
  leaves your browser.
- Quality — every language and script pair carries an **honest quality signal**
  (good / fair) surfaced in the UI, so you know when output is a faithful
  rendering versus a best-effort approximation (e.g. Chinese forward output is a
  nearest-Mandarin-syllable guess; unwritten short vowels in unvocalized Arabic
  or Hebrew can't be recovered).
- Out of the box — the heavy binaries (espeak-ng WASM plus the kuromoji
  dictionary, ~36 MB) ship with the project, so every language and direction
  works on first run.

### Notes
- This release also establishes the project's contributor documentation and
  CI hardening as part of the initial public baseline.
