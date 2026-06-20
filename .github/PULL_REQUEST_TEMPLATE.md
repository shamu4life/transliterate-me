## Summary

<!-- What does this PR do and why? One to three bullet points. -->

-

## Type of change

<!-- Check all that apply -->

- [ ] Bug fix (visible to users → `PATCH`)
- [ ] New feature or capability — new script / source language / romanizer (→ `MINOR`)
- [ ] Breaking change — removed script/language, changed public function signature or token shape (→ `MAJOR`)
- [ ] Internal refactor / styling / accessibility (→ `PATCH`)
- [ ] CI / docs only (no version bump)

## Checklist

### Code

- [ ] `npm test` passes (`node --test` — zero deps to install)
- [ ] `npx wrangler deploy --dry-run` passes
- [ ] New/changed mapping updates the `GOLDEN` table in `test/engine.test.mjs` **intentionally** **— or** N/A
- [ ] Invariants still green — every ARPABET consonant produces output in every script; Chinese output has no Latin pinyin leakage **— or** N/A
- [ ] New script / source language / romanizer registered via the registries (`SCRIPTS` in `src/transliterate.js`, `LANGUAGES` in `src/lang/index.js`, or `SOURCES` + `src/romanize/detect.js`) **— or** N/A
- [ ] Files still run in **both** the browser and `node --test` — no `node_modules` imports in `public/`, no bundler-only syntax **— or** N/A
- [ ] Vendored license notices kept intact (e.g. `public/vendor/espeak/NOTICE.md`, CMU dict, pinyin-pro / kuroshiro / kuromoji) **— or** N/A

### Version & changelog

- [ ] No version bump (CI / docs only) **OR**
- [ ] `package.json` `version` updated
- [ ] `docs/CHANGELOG.md` new section added at the top
- [ ] `README.md` version badge URL updated

### Documentation

- [ ] `README.md` updated (How it works / Output quality / Caveats) **— or** N/A
- [ ] `CLAUDE.md` updated (Architecture / Conventions / registries) **— or** N/A
- [ ] `docs/` screenshots recaptured for any visible UI change **— or** N/A
