#!/usr/bin/env bash
set -euo pipefail

OUT="fillfast.zip"

# Remove old zip if present
rm -f "$OUT"

zip -r "$OUT" \
  manifest.json \
  content.js \
  popup.html \
  popup.css \
  popup.js \
  privacy.html \
  icons/

echo "Created $OUT"
echo ""
echo "Contents:"
unzip -l "$OUT"
