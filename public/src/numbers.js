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

// Plural of a currency unit. Yen is invariant ("500 yen"); the rest take -s.
function pluralizeUnit(unit, n) {
  return n === 1 || unit === 'yen' ? unit : `${unit}s`;
}

function currencyWords(raw, unit) {
  const t = raw.replace(/,/g, '');
  const dm = /^(\d*)\.(\d{1,2})$/.exec(t);
  if (dm) {
    const dollars = dm[1] || '0';
    const cents = String(Number(dm[2].padEnd(2, '0')));
    const dPart = Number(dollars) === 0 ? '' : `${cardinal(dollars)} ${pluralizeUnit(unit, Number(dollars))}`;
    const cPart = Number(cents) === 0 ? '' : `${cardinal(cents)} cent${Number(cents) === 1 ? '' : 's'}`;
    if (dPart && cPart) return `${dPart} and ${cPart}`;
    return dPart || cPart || `zero ${pluralizeUnit(unit, 0)}`;
  }
  // Plain integer or an odd decimal (e.g. 3.500): read the amount via numberValue
  // so digits are never silently dropped, then attach the unit.
  return `${numberValue(t)} ${pluralizeUnit(unit, t === '1' ? 1 : 2)}`;
}

// Ordinal form of a denominator (drop the redundant leading "one" of round
// scales: "one hundredth" -> "hundredth", but keep compound "twenty first").
// Only ever called for den >= 2 (fractionWords handles 0 and 1 first).
function denominatorOrdinal(denStr) {
  const den = Number(denStr);
  if (den === 2) return 'half';
  if (den === 4) return 'quarter';
  let ord = ordinal(denStr);
  if (ord.startsWith('one ')) ord = ord.slice(4);
  return ord;
}

// Idiomatic English fraction words, or null for a/0 (caller falls back).
function fractionWords(numStr, denStr) {
  const den = Number(denStr);
  if (den === 0) return null;
  if (den === 1) return cardinal(numStr);
  const num = Number(numStr);
  let name = denominatorOrdinal(denStr);
  if (num !== 1) name = name === 'half' ? 'halves' : `${name}s`;
  if (num === 1) return `one ${name}`;
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
