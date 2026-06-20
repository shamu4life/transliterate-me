#!/usr/bin/env bash
# Re-fetch / update the large vendored binaries. These files are COMMITTED in
# the repo, so the app works out of the box — you only need this script to
# refresh them to a newer upstream build:
#   - espeak-ng WebAssembly + its JS loader (multi-language G2P)
#   - the kuromoji dictionary (Japanese morphological analysis)
# The espeak NOTICE.md (GPL-3.0 notice) is committed and intentionally left
# untouched. Everything else (pinyin-pro, kuroshiro bundles) is committed too.
set -euo pipefail
tmp="$(mktemp -d)"
echo "Installing espeak-ng + kuromoji into a temp dir…"
( cd "$tmp" && npm init -y >/dev/null 2>&1 && npm install espeak-ng@1.0.2 kuromoji@0.1.2 >/dev/null 2>&1 )
mkdir -p public/vendor/espeak public/vendor/kuromoji-dict
# Keep the loader (.js) and the engine (.wasm) in sync — refresh both together.
cp "$tmp/node_modules/espeak-ng/dist/espeak-ng.wasm" public/vendor/espeak/
cp "$tmp/node_modules/espeak-ng/dist/espeak-ng.js"   public/vendor/espeak/
cp "$tmp/node_modules/kuromoji/dict/"*.dat.gz public/vendor/kuromoji-dict/
rm -rf "$tmp"
echo "Done. Re-vendored:"
echo "  public/vendor/espeak/espeak-ng.wasm"
echo "  public/vendor/espeak/espeak-ng.js"
echo "  public/vendor/kuromoji-dict/ ($(ls public/vendor/kuromoji-dict | wc -l) files)"
