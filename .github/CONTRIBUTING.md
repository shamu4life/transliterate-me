# Contributing to Transliterate Me

Thanks for your interest in contributing! This is a small, dependency-free project — the whole app is plain ES modules plus a few vendored JS/WASM libraries, served as static files. There is no backend, no build step, and no external API calls. [`public/`](../public) *is* the deployed site; everything else is dev tooling. Keep it that way and you'll fit right in.

Contributions are accepted under the project's [GPL-3.0-or-later License](../LICENSE). There is **no CLA** — by opening a pull request you agree your contribution is licensed under GPL-3.0-or-later. The project is GPL because it bundles [espeak-ng](../public/vendor/espeak/) (itself GPL-3.0); distributing it puts the whole project under the GPL. Please keep it that way.

---

## Getting Started

You need [Node.js](https://nodejs.org/) **18+**. There are **no dependencies to install** (`package.json` has none).

```bash
git clone https://github.com/shamu4life/transliterate-me.git
cd transliterate-me

npm start          # serve public/ at http://localhost:8000 (zero-dep Node static server)
npm test           # run the whole suite (node --test, no deps)
```

A static HTTP server is required because the app loads ES modules and the CMU dictionary via `fetch()` — opening `public/index.html` as `file://` will **not** work; use `npm start`.

The two large binaries (espeak-ng's WASM + the kuromoji dictionary, ~36 MB) ship **committed in the repo** (`public/vendor/`), so everything works out of the box. `./vendor.sh` (needs Node/npm) only re-fetches/updates them.

### Tests

The suite uses Node's built-in test runner — nothing to `npm install`. `test/*.test.mjs` import the modules under `public/src/` **directly**, so the tests exercise the exact code the browser runs:

```bash
npm test                                              # all tests
node --test test/engine.test.mjs                      # one file
node --test --test-name-pattern='transliterate "hello"'  # one test
```

Two things pin behavior — keep them green:

- **Golden-output tables.** `test/engine.test.mjs` has a `GOLDEN` table of expected per-script outputs. A mapping change that moves them must update the table **intentionally**, in the same PR.
- **Invariants.** Every ARPABET consonant must produce non-empty output in every script, and Chinese forward output must contain **no Latin pinyin leakage**. Don't regress these when editing mappings.

`engine.test.mjs` and `romanize.test.mjs` need no vendored binaries; `languages.test.mjs` has an end-to-end test against the real espeak-ng WASM (which ships committed, so it runs).

### A change is shippable when:

```bash
npm test          # the suite passes (golden tables + invariants included)
```

passes, **and** you've smoke-tested the affected surface in a browser (`npm start`, then exercise the direction / source language / target script you touched). Don't claim "tested" beyond what the suite covers — the unit tests cover the engine and romanizers; UI wiring and lazy-loading of espeak / pinyin-pro / kuroshiro are verified by hand, so say so and say how.

---

## Self-Hosting & Deploy

The site is fully static with **no build step**, so it can be hosted anywhere. The entire published site is [`public/`](../public); everything else is dev tooling.

- **Cloudflare Workers static assets** (this repo's connected integration). `wrangler.toml` points a [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/) project at `public/` — there's no Worker script; Cloudflare serves the files directly. Cloudflare Workers Builds runs `wrangler deploy` on each push to `main`. To deploy by hand: `npx wrangler deploy`.
- **Any static host** (GitHub Pages, Netlify, S3, …) — just serve the `public/` folder.

---

## Workflow

1. Fork the repo (or, with write access, branch directly) and create a branch from `main`.
2. Make your change under `public/src/`. See [`CLAUDE.md`](../CLAUDE.md) for the architecture and the registry-based extension points.
3. **Work on a branch and open a PR.** A push to `main` triggers a **production deploy** via Cloudflare Workers Builds; CI runs the test suite on every push and pull request.
4. Follow the **versioning**, **documentation**, and **changelog** requirements below.
5. Open a pull request with a clear description (the PR template will prompt you).

---

## House Rules

These are the non-negotiables. A PR that breaks one of them won't be merged without a very good reason:

- **Plain ES modules — no framework, transpiler, or bundler.** Source files in `public/src/` are served to the browser verbatim, and the tests import those same files. Keep them runnable in **both** the browser and `node --test`: no bundler-only syntax, and no `node_modules` imports inside `public/`.
- **Registries are the extension points.** To add a **target script**, add a module in `src/scripts/` and an entry to `SCRIPTS` in `src/transliterate.js`. To add a **source language**, add to `LANGUAGES` in `src/lang/index.js`. To add a **romanizer**, add to `SOURCES` and the `fns` map in `src/romanize/index.js`, plus a Unicode range in `src/romanize/detect.js`. The UI reads from these registries automatically.
- **`quality` fields are honest signals.** The `good` / `fair` / `rough` ratings surface in the UI — set them accurately for new scripts.
- **Client-side only.** No backend and no external API calls — everything runs in the browser. The dictionaries/engines are vendored and lazy-loaded; don't reach for a network service.
- **Keep vendored license notices intact.** When touching `public/vendor/`, preserve each component's license/NOTICE (espeak-ng is GPL-3.0; the CMU dict is BSD-2-Clause; pinyin-pro / kuroshiro / kuromoji are MIT).

---

## Versioning

Standard **semantic versioning** (`MAJOR.MINOR.PATCH`) — the version reflects what a user notices.

| Change type | Increment |
|---|---|
| Removing a language/script, or changing output mappings in a way that breaks existing results for users | `MAJOR` |
| New source language, new target script, new romanizer, or any user-visible feature | `MINOR` |
| Mapping-accuracy fix, copy / styling / accessibility fix, user-visible bug fix | `PATCH` |
| Internal refactor with no visible change | `PATCH` |
| CI / docs only | no bump |

**Tiebreaker:** if a user would notice without being told, it's at least `MINOR`.

A version bump updates **all** of these in the same PR:

| File | What to change |
|---|---|
| `package.json` | `"version"` — source of truth |
| `README.md` | Version badge |
| `docs/CHANGELOG.md` | New section at the top |
| `docs/` screenshots | Recapture if the UI changed (see below) |

Commit message convention: `chore: bump to vX.Y.Z`.

---

## CHANGELOG Format

Add a new section at the top of [`docs/CHANGELOG.md`](../docs/CHANGELOG.md), following [Keep a Changelog](https://keepachangelog.com/):

```markdown
## [X.Y.Z] — YYYY-MM-DD

### Added
- Forward — short description of a new capability, from the user's perspective

### Changed
- Romanize — what changed and how it differs; internal-only refactors get an "(internal)" suffix

### Fixed
- UI — what was broken and what it does now
```

Rules:

- Omit empty sections.
- Write from the user's perspective: "Romanize now…" not "Refactored detect.js to…".
- Start each bullet with the area: `Forward — `, `Romanize — `, `Engine — `, `UI — `.
- One bullet per user-observable change.

---

## Documentation Requirements

Every PR that changes behavior updates the relevant docs in the **same PR**. Stale docs are treated as a bug. The short version:

| What changed | Update |
|---|---|
| New / changed language or script | Output-quality tables in `README.md`, `CLAUDE.md` if architectural, `CHANGELOG` |
| Pipeline or registry change | Architecture in `CLAUDE.md`, "How it works" in `README.md`, `CHANGELOG` |
| Any visible UI change | Recapture screenshots, `CHANGELOG` |
| Version bump | All files in the versioning table above |

On **any visible UI change**, recapture the `docs/` screenshots by hand from the running app — both `docs/screenshot-dark.png` and `docs/screenshot-light.png`, since the README shows whichever matches the reader's system theme.
