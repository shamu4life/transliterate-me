// Parser for the compact CMU dictionary asset (data/cmudict.txt).
//
// Each line is "word AH0 P L ..." — the headword followed by space-separated
// ARPABET symbols. Returns a Map from lowercase word to an array of ARPABET
// symbols (stress digits preserved, so IPA display can show stress).

export function parseCmudict(text) {
  const dict = new Map();
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line) continue;
    const sp = line.indexOf(' ');
    if (sp === -1) continue;
    const word = line.slice(0, sp);
    const phones = line.slice(sp + 1).split(' ');
    dict.set(word, phones);
  }
  return dict;
}
