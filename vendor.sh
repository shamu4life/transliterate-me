#!/usr/bin/env bash
# Re-vendor the large ML binaries that were omitted from the slim archive:
#   - espeak-ng WebAssembly (multi-language G2P)
#   - the kuromoji dictionary (Japanese morphological analysis)
# Everything else (the matching JS glue/bundles) is already in the repo.
set -euo pipefail
tmp="$(mktemp -d)"
echo "Installing espeak-ng + kuromoji into a temp dir…"
( cd "$tmp" && npm init -y >/dev/null 2>&1 && npm install espeak-ng@1.0.2 kuromoji@0.1.2 >/dev/null 2>&1 )
mkdir -p public/vendor/espeak public/vendor/kuromoji-dict
cp "$tmp/node_modules/espeak-ng/dist/espeak-ng.wasm" public/vendor/espeak/
cp "$tmp/node_modules/kuromoji/dict/"*.dat.gz public/vendor/kuromoji-dict/
rm -rf "$tmp"
echo "Done. Vendored:"
echo "  public/vendor/espeak/espeak-ng.wasm"
echo "  public/vendor/kuromoji-dict/ ($(ls public/vendor/kuromoji-dict | wc -l) files)"
