# Security Policy

## Supported versions

Transliterate Me is a single static site (the `public/` folder), shipped from the
`main` branch and deployed to Cloudflare Workers static assets. Only the
**latest released version** receives security fixes.

| Version | Supported |
|---------|-----------|
| latest (`main`) | ✅ |
| older releases  | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's **Report a vulnerability** flow:

1. Go to the repository's **[Security](https://github.com/shamu4life/transliterate-me/security)** tab.
2. Click **Report a vulnerability**.
3. Describe the issue, steps to reproduce, and impact.

This opens a private advisory visible only to the maintainers. We aim to
acknowledge reports within a few days. There is no bug-bounty program — this is
a hobby project — but credit is gladly given in the advisory if you'd like it.

## What is in scope

This app is 100% client-side, so the interesting attack surface is the browser:

- **XSS or HTML injection** via how input text, the romanized result, or the
  transliterated output is rendered into the DOM. Any user-supplied string —
  in any script — that escapes text context and executes or injects markup is a
  bug we want.
- **Unexpected network requests or data exfiltration.** The app must make **no
  external API calls** and send your text nowhere — everything (CMU dictionary,
  espeak-ng WASM, pinyin-pro, kuroshiro/kuromoji) runs locally in the browser.
  If you observe the page issuing any request that leaks input text or contacts
  a third party, that's a vulnerability — please report it.
- **Supply-chain integrity** of the vendored bundles in `public/vendor/`
  (pinyin-pro, kuroshiro/kuromoji, espeak-ng): tampered, mismatched, or
  unexpected-origin binaries/scripts relative to their upstream sources.

## What is *not* a vulnerability (by design)

These are documented properties of a phonetic-transliteration toy, not bugs —
please don't report them:

- **Transliteration / romanization inaccuracy.** The conversion is **lossy,
  phonetic, and approximate by design**: many distinct sounds collapse onto the
  nearest sound a target script can represent, and Chinese forward output is an
  approximate name-transliteration. A "wrong" or imperfect reading is an
  accuracy limitation, not a security issue — see the README Caveats.
- **The size of the bundled WASM / dictionaries.** The espeak-ng WASM and the
  kuromoji dictionary (~36 MB) are intentionally committed so the app works out
  of the box. Their size is a deliberate trade-off, not a defect.
- **No server-side auth / storage issues.** There is no backend, no accounts, no
  database, and nothing stored remotely — so server-side authentication,
  authorization, and storage vulnerabilities do not exist by construction.

See [`README.md`](../README.md) → Caveats and [`CLAUDE.md`](../CLAUDE.md) for the
full design rationale.
