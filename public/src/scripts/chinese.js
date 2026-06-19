// IPA/ARPABET -> approximate Mandarin Chinese (name-transliteration style).
//
// Chinese is logographic, so there is NO true phonetic transliteration. This
// approximates the pronunciation with the nearest *valid* Mandarin syllables —
// the way foreign names are handled (Smith -> 史密斯) — and maps each to a
// conventional transcription character (after the Xinhua 译音表 system). The
// builder only emits legal pinyin syllables; anything not in the character
// table snaps to the closest covered syllable. Treat the output as a rough,
// approximate rendering.

import { stripStress, isVowel } from '../arpabet.js';

// ARPABET consonant -> Mandarin initial.
const INIT = {
  P: 'p', B: 'b', T: 't', D: 'd', K: 'k', G: 'g', F: 'f', V: 'f',
  S: 's', Z: 'z', SH: 'sh', ZH: 'sh', CH: 'ch', JH: 'zh', TH: 's',
  DH: 'd', HH: 'h', M: 'm', N: 'n', L: 'l', R: 'l', W: 'w', Y: 'y', NG: 'n',
};

// Vowel -> open-syllable final (no coda).
const FINAL = {
  AA: 'a', AE: 'ai', AH: 'a', AO: 'ao', AW: 'ao', AY: 'ai', EH: 'e',
  ER: 'er', EY: 'ei', IH: 'i', IY: 'i', OW: 'ou', OY: 'ei', UH: 'u', UW: 'u',
};
// Vowel "colour" for choosing a coda-compatible final.
const COLOR = {
  AA: 'a', AE: 'a', AH: 'a', AW: 'a', AY: 'a', EH: 'e', EY: 'e', ER: 'e',
  IH: 'i', IY: 'i', UH: 'u', UW: 'u', AO: 'o', OW: 'o', OY: 'o',
};
// Default vowel appended to a coda/cluster consonant to make a syllable.
const CODA_FINAL = {
  S: 'i', Z: 'i', SH: 'i', ZH: 'i', CH: 'i', JH: 'i', TH: 'i', DH: 'e',
  T: 'e', D: 'e', K: 'e', G: 'e', HH: 'e', P: 'u', B: 'u', F: 'u', V: 'u',
  M: 'u', L: 'er', R: 'er', N: 'en', NG: 'eng',
};

// Build a legal final from a vowel and an optional nasal coda ('n' | 'ng').
function buildFinal(vowel, coda, hasOnset) {
  if (!coda) {
    if (vowel === 'ER') return hasOnset ? 'e' : 'er';
    return FINAL[vowel];
  }
  const c = COLOR[vowel];
  if (coda === 'ng') return (c === 'o' || c === 'u' ? 'o' : c) + 'ng'; // ang/eng/ing/ong
  // n coda: an/en/in/un exist; o-colour has no *on*, route to ong.
  if (c === 'o') return 'ong';
  return c + 'n';
}

// Representative transcription character per pinyin syllable (Xinhua-style).
// Covers the syllables the builder produces; gaps snap to a simpler syllable.
const CHAR = {
  a: '阿', ai: '艾', an: '安', ang: '昂', ao: '奥', e: '厄', ei: '埃', en: '恩',
  eng: '恩', er: '尔', o: '奥', ou: '欧', ong: '翁', i: '伊', in: '因',
  ing: '英', u: '乌', un: '温',
  ba: '巴', bai: '拜', ban: '班', bang: '邦', bao: '鲍', bei: '贝', ben: '本',
  beng: '本', bi: '比', bin: '宾', bing: '宾', bo: '博', bou: '博', bu: '布',
  pa: '帕', pai: '派', pan: '潘', pang: '庞', pao: '保', pei: '佩', pen: '彭',
  peng: '彭', pi: '皮', pin: '平', ping: '平', po: '波', pou: '波', pu: '普',
  ma: '马', mai: '迈', man: '曼', mang: '芒', mao: '毛', mei: '梅', men: '门',
  meng: '蒙', mi: '米', min: '明', ming: '明', mo: '莫', mou: '莫', mu: '姆',
  fa: '法', fai: '法', fan: '凡', fang: '方', fao: '福', fei: '菲', fen: '芬',
  feng: '丰', fi: '菲', fin: '芬', fing: '芬', fo: '佛', fou: '福', fu: '夫',
  da: '达', dai: '戴', dan: '丹', dang: '当', dao: '道', de: '德', dei: '戴',
  den: '登', deng: '登', di: '迪', din: '丁', ding: '丁', dong: '东', dou: '杜',
  du: '杜', duo: '多',
  ta: '塔', tai: '泰', tan: '坦', tang: '唐', tao: '陶', te: '特', tei: '泰',
  ten: '滕', teng: '腾', ti: '蒂', tin: '丁', ting: '廷', tong: '通', tou: '图',
  tu: '图', tuo: '托',
  na: '娜', nai: '奈', nan: '南', nang: '南', nao: '瑙', ne: '内', nei: '内',
  nen: '嫩', neng: '能', ni: '尼', nin: '宁', ning: '宁', nong: '农', nou: '诺',
  nu: '努', nuo: '诺',
  la: '拉', lai: '莱', lan: '兰', lang: '朗', lao: '劳', le: '勒', lei: '雷',
  len: '伦', leng: '楞', li: '利', lin: '林', ling: '林', long: '隆', lou: '楼',
  lu: '卢', luo: '罗', ler: '勒',
  ga: '加', gai: '盖', gan: '甘', gang: '冈', gao: '高', ge: '格', gei: '盖',
  gen: '根', geng: '根', gi: '吉', gin: '金', ging: '金', gong: '贡', gou: '古',
  gu: '古', guo: '郭',
  ka: '卡', kai: '凯', kan: '坎', kang: '康', kao: '考', ke: '克', kei: '凯',
  ken: '肯', keng: '肯', ki: '基', kin: '金', king: '金', kong: '孔', kou: '库',
  ku: '库', kuo: '阔',
  ha: '哈', hai: '海', han: '汉', hang: '杭', hao: '豪', he: '赫', hei: '海',
  hen: '亨', heng: '亨', hi: '希', hin: '欣', hing: '兴', hong: '洪', hou: '胡',
  hu: '胡', huo: '霍',
  sa: '萨', sai: '赛', san: '桑', sang: '桑', sao: '绍', se: '塞', sei: '塞',
  sen: '森', seng: '森', si: '斯', sin: '辛', sing: '辛', song: '松', sou: '苏',
  su: '苏', suo: '索',
  za: '扎', zai: '宰', zan: '赞', zang: '藏', zao: '藻', ze: '泽', zei: '宰',
  zen: '岑', zeng: '曾', zi: '兹', zin: '津', zing: '京', zong: '宗', zou: '邹',
  zu: '祖', zuo: '佐',
  sha: '沙', shai: '夏', shan: '山', shang: '尚', shao: '邵', she: '舍',
  shei: '谢', shen: '申', sheng: '盛', shi: '史', shin: '欣', shing: '兴',
  shong: '雄', shou: '寿', shu: '舒', shuo: '朔',
  cha: '查', chai: '柴', chan: '钱', chang: '昌', chao: '乔', che: '切',
  chei: '柴', chen: '陈', cheng: '成', chi: '奇', chin: '钦', ching: '青',
  chong: '琼', chou: '楚', chu: '楚', chuo: '绰',
  zha: '扎', zhai: '杰', zhan: '詹', zhang: '张', zhao: '焦', zhe: '哲',
  zhei: '杰', zhen: '真', zheng: '郑', zhi: '吉', zhin: '金', zhing: '京',
  zhong: '钟', zhou: '朱', zhu: '朱', zhuo: '卓',
  wa: '瓦', wai: '怀', wan: '万', wang: '王', wao: '沃', wei: '韦',
  wen: '文', weng: '翁', wi: '维', win: '温', wing: '温', wo: '沃', wong: '翁',
  wou: '沃', wu: '伍', wuo: '沃',
  ya: '亚', yai: '耶', yan: '扬', yang: '杨', yao: '尧', ye: '耶', yei: '耶',
  yen: '延', yeng: '英', yi: '伊', yin: '因', ying: '英', yong: '永', you: '尤',
  yu: '尤', yuo: '约',
};

// Fix initial+final combinations Mandarin doesn't allow before lookup. The main
// case: labials and w have no bare '-e' final, so b/p/m/f/w + e -> -o (bo, wo…).
function legalize(init, final) {
  if (final === 'e' && /^[bpmfw]$/.test(init)) return 'o';
  return final;
}

// Snap a syllable to a covered character: try as-is, then drop a final 'g'
// (ng->n), then strip the coda, then fall back to the bare vowel/initial.
function charFor(init, finalRaw) {
  const final = legalize(init, finalRaw);
  const tries = [init + final];
  if (final.endsWith('ng')) tries.push(init + final.slice(0, -1)); // ang->an
  if (/[ng]$/.test(final)) tries.push(init + final.replace(/n?g?$/, '')); // drop coda
  tries.push(init + (FINAL_BASE[final] || final[0]));
  tries.push(final, final[0]);
  for (const t of tries) if (CHAR[t]) return CHAR[t];
  return init + final; // last resort: pinyin (should be rare)
}
const FINAL_BASE = {
  ang: 'a', eng: 'e', ing: 'i', ong: 'o', an: 'a', en: 'e', in: 'i', un: 'u',
};

export function toChinese(phonemes) {
  const p = stripStress(phonemes);
  const syl = []; // [init, final]
  let i = 0;

  // Fold a trailing nasal coda (if any) into the current syllable.
  const takeCoda = () => {
    const n = p[i];
    if ((n === 'N' || n === 'M') && !isVowel(p[i + 1])) { i += 1; return 'n'; }
    if (n === 'NG' && !isVowel(p[i + 1])) { i += 1; return 'ng'; }
    return '';
  };

  while (i < p.length) {
    const cur = p[i];
    if (cur === 'ː') { i += 1; continue; }
    if (isVowel(cur)) {
      i += 1;
      syl.push(['', buildFinal(cur, takeCoda(), false)]);
    } else if ((cur === 'W' || cur === 'Y') && isVowel(p[i + 1])) {
      const init = cur === 'W' ? 'w' : 'y';
      const v = p[i + 1]; i += 2;
      syl.push([init, buildFinal(v, takeCoda(), true)]);
    } else if (isVowel(p[i + 1])) {
      const init = INIT[cur]; const v = p[i + 1]; i += 2;
      syl.push([init, buildFinal(v, takeCoda(), true)]);
    } else {
      // coda/cluster consonant with no following vowel -> its own syllable
      syl.push([INIT[cur] || '', CODA_FINAL[cur] || 'e']);
      i += 1;
    }
  }
  return syl.map(([init, final]) => charFor(init, final)).join('');
}
