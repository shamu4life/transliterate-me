// Letter-table romanizers for the alphabetic / abjad scripts: Cyrillic, Greek,
// Arabic, and Hebrew. These are practical, approximate transliterations. The
// abjads (Arabic, Hebrew) normally omit short vowels, so romanization can only
// recover what is written (consonants and long vowels).

// Map a segment through a per-character table, honouring optional multi-char
// digraphs and preserving capitalization of the source letter.
function mapChars(seg, table, digraphs) {
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  let out = '';
  for (let i = 0; i < seg.length; i++) {
    if (digraphs) {
      const two = seg.substr(i, 2);
      const d = digraphs[two.toLowerCase()];
      if (d !== undefined) {
        out += two[0] === two[0].toUpperCase() ? cap(d) : d;
        i += 1;
        continue;
      }
    }
    const ch = seg[i];
    const lower = ch.toLowerCase();
    const r = table[lower];
    if (r === undefined) { out += ch; continue; }
    out += ch !== lower ? cap(r) : r;
  }
  return out;
}

const CYRILLIC = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'yo', є: 'ye',
  ж: 'zh', з: 'z', и: 'i', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh',
  ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e',
  ю: 'yu', я: 'ya',
};

const GREEK = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i',
  κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's',
  ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
  ά: 'a', έ: 'e', ή: 'i', ί: 'i', ό: 'o', ύ: 'y', ώ: 'o', ϊ: 'i', ϋ: 'y',
  ΐ: 'i', ΰ: 'y',
};
const GREEK_DI = { ου: 'ou', αυ: 'av', ευ: 'ev', γγ: 'ng', γκ: 'g', μπ: 'b', ντ: 'd' };

export const romanizeCyrillic = (s) => mapChars(s, CYRILLIC);
export const romanizeGreek = (s) => mapChars(s, GREEK, GREEK_DI);

// --- Arabic ---------------------------------------------------------------
// Position-aware: the "weak letters" و/ي act as long vowels (mater lectionis)
// after a consonant and as consonants (w/y) otherwise; ا is a long a. Harakat
// (short-vowel diacritics) and shadda (gemination) are applied when present.
// Unwritten short vowels in unvocalized text cannot be recovered.
const AR_CONS = {
  ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh', د: 'd', ذ: 'dh', ر: 'r',
  ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: "'", غ: 'gh',
  ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', ء: "'", ئ: "'", ؤ: "'",
};
const AR_HARAKAT = {
  'َ': 'a', 'ِ': 'i', 'ُ': 'u', 'ً': 'an', 'ٍ': 'in', 'ٌ': 'un', 'ْ': '', 'ـ': '',
};
const AR_SHADDA = 'ّ';

export function romanizeArabic(seg) {
  let out = '';
  let prevCons = false;
  let lastCons = '';
  for (const ch of seg) {
    if (ch === AR_SHADDA) { out += lastCons; continue; } // gemination
    if (ch in AR_HARAKAT) { out += AR_HARAKAT[ch]; if (AR_HARAKAT[ch]) prevCons = false; continue; }
    if (ch === 'ا' || ch === 'أ' || ch === 'ى' || ch === 'ة') { out += 'a'; prevCons = false; continue; }
    if (ch === 'آ') { out += 'aa'; prevCons = false; continue; }
    if (ch === 'إ') { out += 'i'; prevCons = false; continue; }
    if (ch === 'و') { const r = prevCons ? 'u' : 'w'; out += r; lastCons = r; prevCons = r === 'w'; continue; }
    if (ch === 'ي') { const r = prevCons ? 'i' : 'y'; out += r; lastCons = r; prevCons = r === 'y'; continue; }
    if (AR_CONS[ch] !== undefined) { out += AR_CONS[ch]; lastCons = AR_CONS[ch]; prevCons = true; continue; }
    out += ch; prevCons = false;
  }
  return out;
}

// --- Hebrew ---------------------------------------------------------------
// Same idea: ו/י are matres lectionis (o/u, i) after a consonant, else v/y;
// niqqud vowel points are applied when present (incl. shuruk וּ, holam-vav וֹ).
const HE_CONS = {
  ב: 'v', ג: 'g', ד: 'd', ה: 'h', ז: 'z', ח: 'kh', ט: 't', כ: 'k', ך: 'k',
  ל: 'l', מ: 'm', ם: 'm', נ: 'n', ן: 'n', ס: 's', ע: "'", פ: 'p', ף: 'f',
  צ: 'ts', ץ: 'ts', ק: 'k', ר: 'r', ש: 'sh', ת: 't',
};
const HE_NIQQUD = {
  'ַ': 'a', 'ָ': 'a', 'ֵ': 'e', 'ֶ': 'e', 'ִ': 'i', 'ֹ': 'o', 'ֺ': 'o',
  'ֻ': 'u', 'ְ': '', 'ּ': '', 'ׁ': '', 'ׂ': '', 'ֲ': 'a', 'ֱ': 'e', 'ֳ': 'o',
};

export function romanizeHebrew(seg) {
  const s = [...seg];
  let out = '';
  let prevCons = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === 'ו') { // vav: shuruk / holam-vav / mater / consonant
      const next = s[i + 1];
      if (next === 'ּ') { out += 'u'; i += 1; prevCons = false; continue; }
      if (next === 'ֹ') { out += 'o'; i += 1; prevCons = false; continue; }
      const r = prevCons ? 'o' : 'v';
      out += r; prevCons = r === 'v'; continue;
    }
    if (ch === 'י') { const r = prevCons ? 'i' : 'y'; out += r; prevCons = r === 'y'; continue; }
    if (ch === 'א') { out += 'a'; prevCons = false; continue; } // aleph: vowel carrier
    if (ch in HE_NIQQUD) { out += HE_NIQQUD[ch]; if (HE_NIQQUD[ch]) prevCons = false; continue; }
    if (HE_CONS[ch] !== undefined) { out += HE_CONS[ch]; prevCons = HE_CONS[ch] !== "'"; continue; }
    out += ch; prevCons = false;
  }
  return out;
}
