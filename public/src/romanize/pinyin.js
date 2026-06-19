// Chinese (Han characters) -> Hanyu Pinyin.
//
// Delegates to the vendored pinyin-pro library, which segments text into words
// and resolves context-dependent polyphones (e.g. 长大 -> zhǎng dà but
// 长城 -> cháng chéng). The library function is injected rather than imported
// here so it can be lazy-loaded by the app and stubbed in tests.

// Romanize a run of Han characters. `pinyinFn` is pinyin-pro's `pinyin`.
// opts.tones: 'marks' (default, ā á) | 'numbers' (a1 a2).
export function romanizeHan(segment, pinyinFn, opts = {}) {
  if (!pinyinFn) return segment; // library not loaded yet — leave unchanged
  const toneType = opts.tones === 'numbers' ? 'num' : 'symbol';
  return pinyinFn(segment, { toneType, nonZh: 'consecutive' });
}
