// IPA/ARPABET -> Russian Cyrillic, in the style of practical transcription
// used for rendering foreign names. Mostly a linear phoneme map; a /j/ glide
// before a vowel produces the iotated vowels (я е ё ю и).

import { stripStress, isVowel } from '../arpabet.js';

const CONS = {
  B: 'б', CH: 'ч', D: 'д', DH: 'д', F: 'ф', G: 'г', HH: 'х', JH: 'дж',
  K: 'к', L: 'л', M: 'м', N: 'н', NG: 'нг', P: 'п', R: 'р', S: 'с',
  SH: 'ш', T: 'т', TH: 'т', V: 'в', Z: 'з', ZH: 'ж', W: 'в',
};

const VOW = {
  AA: 'а', AE: 'э', AH: 'а', AO: 'о', AW: 'ау', AY: 'ай', EH: 'э',
  ER: 'эр', EY: 'эй', IH: 'и', IY: 'и', OW: 'о', OY: 'ой', UH: 'у', UW: 'у',
};

// Iotated (soft) vowels after /j/.
const IOTATED = {
  AA: 'я', AE: 'е', AH: 'я', AO: 'ё', AW: 'яу', AY: 'яй', EH: 'е',
  ER: 'ер', EY: 'ей', IH: 'и', IY: 'и', OW: 'ё', OY: 'ёй', UH: 'ю', UW: 'ю',
};

export function toCyrillic(phonemes) {
  const p = stripStress(phonemes);
  let out = '';
  let i = 0;
  while (i < p.length) {
    const cur = p[i];
    if (cur === 'Y' && isVowel(p[i + 1])) {
      out += IOTATED[p[i + 1]] || VOW[p[i + 1]];
      i += 2;
      continue;
    }
    if (isVowel(cur)) out += VOW[cur] || '';
    else if (cur === 'Y') out += 'й';
    else out += CONS[cur] || '';
    i += 1;
  }
  return out;
}
