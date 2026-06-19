// Japanese kana -> Romaji (Hepburn-style).
//
// Handles hiragana and katakana (katakana is normalised to hiragana first),
// including small ゃゅょ (youon), the small っ sokuon (gemination), the long
// vowel mark ー, and ん. Kanji cannot be romanised without a context-aware
// dictionary, so any non-kana characters pass through unchanged.

const BASE = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'wi', ゑ: 'we', を: 'wo', ん: 'n', ゔ: 'vu',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o',
};

// i-row kana -> consonant cluster used to build youon (e.g. き -> ky -> kya).
const YOUON_CONS = {
  き: 'ky', ぎ: 'gy', し: 'sh', じ: 'j', ち: 'ch', に: 'ny',
  ひ: 'hy', び: 'by', ぴ: 'py', み: 'my', り: 'ry',
};
const SMALL_Y = { ゃ: 'a', ゅ: 'u', ょ: 'o' };

// Convert katakana to the equivalent hiragana so one table covers both.
function toHiragana(str) {
  let out = '';
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x30a1 && cp <= 0x30f6) out += String.fromCodePoint(cp - 0x60);
    else out += ch;
  }
  return out;
}

export function romanizeKana(segment) {
  const chars = [...toHiragana(segment)];
  let out = '';
  let gemination = false;

  const push = (romaji) => {
    if (gemination && romaji) {
      // Hepburn doubles the consonant; ch geminates as "tch".
      out += romaji.startsWith('ch') ? 't' : romaji[0];
      gemination = false;
    }
    out += romaji;
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];

    if (ch === 'っ') { gemination = true; continue; }
    if (ch === 'ー' || ch === '〜') {
      // Long vowel: repeat the previous vowel.
      const last = out[out.length - 1];
      if ('aeiou'.includes(last)) out += last;
      continue;
    }
    if (YOUON_CONS[ch] && SMALL_Y[next]) {
      push(YOUON_CONS[ch] + SMALL_Y[next]);
      i += 1;
      continue;
    }
    if (BASE[ch]) {
      push(BASE[ch]);
      continue;
    }
    out += ch; // kanji / unknown — leave as-is
  }
  return out;
}
