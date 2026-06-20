# Changelog

All notable changes to Transliterate Me are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
