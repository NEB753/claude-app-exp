#!/usr/bin/env bash
# Builds a standalone Terrain Gen website into OUT (default: _site).
#   ./build-web.sh _site            → for GitHub Pages / any static host (installable PWA)
#   ./build-web.sh native/www --vendor  → for the Capacitor test app (three.js bundled for offline use)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${1:-_site}"; VENDOR="${2:-}"
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$HERE/js" "$OUT/js"
cp -r "$HERE/tex" "$OUT/tex"
cp "$HERE"/pwa/* "$OUT/"
# stamp a build id into the service worker so every deploy replaces the old cache
BUILD="$(cd "$HERE" && cat index.html js/*.js | (sha1sum 2>/dev/null || shasum) | cut -c1-10)"
sed -i.bak "s#__BUILD__#$BUILD#g" "$OUT/sw.js" && rm -f "$OUT"/sw.js.bak
THREE='https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
{
  printf '<!doctype html><html lang="en"><head><meta charset="utf-8">'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">'
  printf '<link rel="manifest" href="manifest.webmanifest"><link rel="apple-touch-icon" href="apple-touch-icon.png"><link rel="icon" href="icon-192.png">'
  printf '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%%}[hidden]{display:none!important}</style></head><body>'
  cat "$HERE/index.html"
  printf '</body></html>\n'
} > "$OUT/index.html"
if [ "$VENDOR" = "--vendor" ]; then
  mkdir -p "$OUT/vendor"
  curl -fsSL "$THREE" -o "$OUT/vendor/three.min.js"
  sed -i.bak "s#$THREE#vendor/three.min.js#g" "$OUT/index.html" "$OUT/sw.js" && rm -f "$OUT"/*.bak
fi
echo "Built $OUT"
