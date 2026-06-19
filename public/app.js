// Front-end glue for both directions:
//   Mode 1 (forward):  English -> IPA -> chosen world script.
//   Mode 2 (romanize): any supported script -> Latin alphabet.
//
// The English dictionary loads up front (forward mode is the default); the
// Chinese pinyin dictionary loads lazily the first time the romanize tab is used.

import { parseCmudict } from './src/dict.js';
import { phonemizeText, phonemizeTextEspeak } from './src/phonemize.js';
import { transliterateTokens, transliteratePhonemes, SCRIPTS, getScript } from './src/transliterate.js';

import { romanizeText, detectPrimary, isJapanese, SOURCES } from './src/romanize/index.js';
import { LANGUAGES, getLanguage } from './src/lang/index.js';
import { initEspeak, phonemizeLine, isEspeakReady } from './src/lang/espeak.js';

const QUALITY_TEXT = {
  good: 'Maps cleanly from pronunciation — a faithful phonetic rendering.',
  fair: 'Approximate: this script lacks some English sounds, so a few are merged.',
  rough: 'Experimental: only a rough, nearest-equivalent guess.',
};

const SOURCE_LABEL = {
  han: 'Chinese (Han)', kana: 'Japanese (kana)', hangul: 'Korean (Hangul)',
  cyrillic: 'Cyrillic', greek: 'Greek', arabic: 'Arabic', hebrew: 'Hebrew',
};

const el = (id) => document.getElementById(id);

const LANG_NOTE = {
  dict: 'Uses the CMU pronunciation dictionary (American English) — instant, offline.',
  espeak: 'Pronunciation by espeak-ng (GPL-3.0). Loads a ~18.5 MB engine on first non-English use.',
};

// ---- Forward mode state ----
let cmudict = null;
let currentScript = SCRIPTS[0].id;
let currentLang = 'en';
let fwdToken = 0; // guards against out-of-order async forward renders
// Word-separator preference (· / ・). On by default; remembered when toggled off.
let separateWords = (() => {
  try { return localStorage.getItem('wordSep') !== 'off'; } catch { return true; }
})();

// ---- Romanize mode state ----
let pinyinFn = null; // pinyin-pro's pinyin(), lazy-loaded
let pinyinLoading = null;
let japaneseFn = null; // kuroshiro toRomaji(), lazy-loaded with its dictionary
let japaneseLoading = null;

// =================== Forward mode ===================

function buildChips() {
  for (const s of SCRIPTS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = s.name;
    chip.dataset.id = s.id;
    chip.setAttribute('role', 'tab');
    chip.setAttribute('aria-selected', String(s.id === currentScript));
    chip.addEventListener('click', () => selectScript(s.id));
    el('script-chips').appendChild(chip);
  }
}

function selectScript(id) {
  currentScript = id;
  for (const chip of el('script-chips').children) {
    chip.setAttribute('aria-selected', String(chip.dataset.id === id));
  }
  const s = getScript(id);
  el('quality-note').innerHTML =
    `<span class="quality-badge ${s.quality}">${s.quality}</span>${s.note || QUALITY_TEXT[s.quality]}`;
  updateSepToggle();
  renderForward();
}

// The word-separator toggle is only meaningful for scripts that use one
// (Chinese ·, Katakana ・); hide it for the rest.
function updateSepToggle() {
  const s = getScript(currentScript);
  const label = el('sep-toggle-label');
  if (s.wordSep) {
    el('sep-toggle-text').textContent = `Separate words with “${s.wordSep}”`;
    el('sep-toggle').checked = separateWords;
    label.hidden = false;
  } else {
    label.hidden = true;
  }
}

function buildLangOptions() {
  for (const l of LANGUAGES) {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    el('lang-select').appendChild(opt);
  }
  el('lang-select').addEventListener('change', () => selectLang(el('lang-select').value));
}

function selectLang(id) {
  currentLang = id;
  const L = getLanguage(id);
  el('lang-note').textContent = LANG_NOTE[L.engine];
  renderForward();
}

// Lazy-load the espeak engine (~18.5 MB) on first non-English use.
async function ensureEspeak() {
  if (isEspeakReady()) return;
  await initEspeak();
}

async function renderForward() {
  const lang = getLanguage(currentLang);
  const text = el('input-text').value;
  const token = ++fwdToken;

  let tokens;
  if (lang.engine === 'dict') {
    if (!cmudict) return; // English needs the dictionary loaded
    tokens = phonemizeText(text, cmudict, lang.g2p);
  } else {
    if (!isEspeakReady()) {
      el('output-text').textContent = 'Loading pronunciation engine (~18.5 MB, first non-English use)…';
      await ensureEspeak();
      if (token !== fwdToken) return; // superseded while loading
    }
    tokens = await phonemizeTextEspeak(text, lang.voice, phonemizeLine);
    if (token !== fwdToken) return;
  }
  renderForwardTokens(tokens);
}

function renderForwardTokens(tokens) {
  const script = getScript(currentScript);
  el('output-text').textContent = transliterateTokens(tokens, currentScript, { separate: separateWords }) || ' ';
  el('output-text').dir = script.rtl ? 'rtl' : 'ltr';
  el('ipa-text').textContent =
    tokens.map((t) => (t.type === 'word' ? t.ipa : t.text)).join('') || ' ';

  const tbody = document.querySelector('#breakdown tbody');
  tbody.replaceChildren();
  for (const t of tokens) {
    if (t.type !== 'word') continue;
    const tr = document.createElement('tr');
    const target = transliteratePhonemes(t.phonemes, currentScript) || '—';
    const srcLabel = { dict: 'dictionary', rule: 'rules', espeak: 'espeak-ng', none: 'unknown' }[t.source];
    tr.innerHTML = `
      <td>${escapeHtml(t.text)}</td>
      <td class="ipa">${escapeHtml(t.ipa || '—')}</td>
      <td class="target"${script.rtl ? ' dir="rtl"' : ''}>${escapeHtml(target)}</td>
      <td class="src-${t.source}">${srcLabel}</td>`;
    tbody.appendChild(tr);
  }
}

// =================== Romanize mode ===================

function buildSourceOptions() {
  for (const s of SOURCES) {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    el('rom-source').appendChild(opt);
  }
}

async function ensurePinyin() {
  if (pinyinFn) return;
  if (!pinyinLoading) {
    pinyinLoading = import('./vendor/pinyin-pro.mjs').then((m) => { pinyinFn = m.pinyin; });
  }
  await pinyinLoading;
}

// Lazy-load kuroshiro + the kuromoji dictionary (~18 MB) on first Japanese use.
async function ensureJapanese() {
  if (japaneseFn) return;
  if (!japaneseLoading) {
    japaneseLoading = import('./vendor/kuroshiro.bundle.mjs')
      .then((m) => m.init('./vendor/kuromoji-dict/').then(() => { japaneseFn = m.toRomaji; }));
  }
  await japaneseLoading;
}

let renderToken = 0; // guards against out-of-order async renders

async function renderRomanize() {
  const text = el('rom-input').value;
  const source = el('rom-source').value;
  const tones = el('rom-tones').value;
  const token = ++renderToken;

  const detected = detectPrimary(text);
  el('rom-detected').textContent = detected
    ? `Detected source: ${SOURCE_LABEL[detected] || detected}.`
    : 'Type or paste text in a non-Latin script.';

  await ensurePinyin();
  if (isJapanese(text, source) && !japaneseFn) {
    el('rom-output').textContent = 'Loading Japanese analyzer (~18 MB, first use only)…';
    await ensureJapanese();
  }
  if (token !== renderToken) return; // a newer keystroke superseded this render

  const out = await romanizeText(text, { pinyin: pinyinFn, japanese: japaneseFn, source, tones });
  if (token === renderToken) el('rom-output').textContent = out || ' ';
}

// =================== Mode switching ===================

function switchMode(mode) {
  const forward = mode === 'forward';
  el('mode-forward').hidden = !forward;
  el('mode-romanize').hidden = forward;
  el('footer-forward').hidden = !forward;
  el('footer-romanize').hidden = forward;
  for (const tab of document.querySelectorAll('.mode-tab')) {
    tab.setAttribute('aria-selected', String(tab.dataset.mode === mode));
  }
  if (!forward) renderRomanize();
}

// =================== Shared helpers / init ===================

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}

function wireCopy(buttonId, sourceId) {
  el(buttonId).addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(el(sourceId).textContent.trim());
      el(buttonId).textContent = 'Copied!';
      setTimeout(() => { el(buttonId).textContent = 'Copy'; }, 1200);
    } catch {
      el(buttonId).textContent = 'Copy failed';
    }
  });
}

// ---- Theme: auto (follow device) / light / dark, remembered ----
const THEMES = ['auto', 'light', 'dark'];
const THEME_ICON = { auto: '🖥️', light: '☀️', dark: '🌙' };

function readTheme() {
  let t = null;
  try { t = localStorage.getItem('theme'); } catch { /* storage blocked */ }
  return THEMES.includes(t) ? t : 'auto';
}

// Pin the chosen theme via data-theme on <html> (or remove it for "auto", which
// lets the stylesheet's prefers-color-scheme media query follow the device).
function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const btn = el('theme-toggle');
  const label = theme[0].toUpperCase() + theme.slice(1);
  btn.textContent = `${THEME_ICON[theme]} ${label}`;
  btn.setAttribute('aria-label', `Theme: ${label} (click to change)`);
  btn.title = btn.getAttribute('aria-label');
}

function initTheme() {
  applyTheme(readTheme());
  el('theme-toggle').addEventListener('click', () => {
    const next = THEMES[(THEMES.indexOf(readTheme()) + 1) % THEMES.length];
    try { localStorage.setItem('theme', next); } catch { /* storage blocked */ }
    applyTheme(next);
  });
}

async function init() {
  initTheme();
  buildChips();
  selectScript(currentScript);
  buildLangOptions();
  selectLang(currentLang);
  buildSourceOptions();

  for (const tab of document.querySelectorAll('.mode-tab')) {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  }
  el('rom-input').addEventListener('input', renderRomanize);
  el('rom-source').addEventListener('change', renderRomanize);
  el('rom-tones').addEventListener('change', renderRomanize);
  wireCopy('copy-btn', 'output-text');
  wireCopy('rom-copy', 'rom-output');
  el('sep-toggle').addEventListener('change', () => {
    separateWords = el('sep-toggle').checked;
    try { localStorage.setItem('wordSep', separateWords ? 'on' : 'off'); } catch { /* storage blocked */ }
    renderForward();
  });

  try {
    const res = await fetch('./data/cmudict.txt');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cmudict = parseCmudict(await res.text());
  } catch (err) {
    el('loading').textContent = `Could not load the dictionary: ${err.message}`;
    return;
  }
  el('loading').classList.add('hidden');
  el('input-text').addEventListener('input', renderForward);
  renderForward();
}

init();
