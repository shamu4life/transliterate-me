// Wrapper around the vendored espeak-ng WebAssembly build (GPL-3.0), used for
// grapheme-to-phoneme (IPA) conversion of many languages.
//
// The WASM module exposes a CLI-style interface (no reusable callMain), so each
// phonemization spins up an instance with the cached wasm binary (~120 ms) and
// reads the IPA output from its in-memory FS. Results are memoised. The 18.5 MB
// binary is fetched once, lazily, on first use.

let factory = null;
let wasmBinary = null;
let loading = null;
const cache = new Map(); // `${voice}\n${text}` -> ipa string

export function isEspeakReady() {
  return factory !== null && wasmBinary !== null;
}

export async function initEspeak() {
  if (isEspeakReady()) return;
  if (!loading) {
    loading = (async () => {
      const mod = await import('../../vendor/espeak/espeak-ng.js');
      factory = mod.default;
      const res = await fetch(new URL('../../vendor/espeak/espeak-ng.wasm', import.meta.url));
      wasmBinary = await res.arrayBuffer();
    })();
  }
  await loading;
}

// Phonemize one line of text in the given espeak voice -> IPA string.
export async function phonemizeLine(text, voice) {
  const key = `${voice}\n${text}`;
  if (cache.has(key)) return cache.get(key);
  const espeak = await factory({
    wasmBinary,
    arguments: ['--phonout', 'o', '--sep=', '-q', '--ipa=3', '-v', voice, text],
    print() {}, printErr() {},
  });
  const out = espeak.FS.readFile('o', { encoding: 'utf8' }).trim();
  cache.set(key, out);
  return out;
}
