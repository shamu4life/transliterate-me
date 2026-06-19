// Registry of source languages for the forward (text → IPA → script) direction.
//
// English uses the CMU pronunciation dictionary (loaded by the app) — it's
// instant, offline, and high quality. Every other language is phonemized by
// espeak-ng (WASM), which covers many regular-orthography languages at high
// fidelity from a single engine. The espeak dictionary (~18.5 MB) loads lazily
// on the first non-English use.

import { g2p as englishG2p } from '../g2p.js';

export const LANGUAGES = [
  { id: 'en', name: 'English', engine: 'dict', g2p: englishG2p, quality: 'dict' },
  { id: 'es', name: 'Spanish', engine: 'espeak', voice: 'es' },
  { id: 'fr', name: 'French', engine: 'espeak', voice: 'fr' },
  { id: 'de', name: 'German', engine: 'espeak', voice: 'de' },
  { id: 'it', name: 'Italian', engine: 'espeak', voice: 'it' },
  { id: 'pt', name: 'Portuguese', engine: 'espeak', voice: 'pt' },
  { id: 'nl', name: 'Dutch', engine: 'espeak', voice: 'nl' },
  { id: 'pl', name: 'Polish', engine: 'espeak', voice: 'pl' },
  { id: 'ca', name: 'Catalan', engine: 'espeak', voice: 'ca' },
  { id: 'ro', name: 'Romanian', engine: 'espeak', voice: 'ro' },
  { id: 'cs', name: 'Czech', engine: 'espeak', voice: 'cs' },
  { id: 'sv', name: 'Swedish', engine: 'espeak', voice: 'sv' },
  { id: 'da', name: 'Danish', engine: 'espeak', voice: 'da' },
  { id: 'tr', name: 'Turkish', engine: 'espeak', voice: 'tr' },
];

const BY_ID = new Map(LANGUAGES.map((l) => [l.id, l]));

export function getLanguage(id) {
  return BY_ID.get(id) || LANGUAGES[0];
}
