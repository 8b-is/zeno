#!/usr/bin/env bash
# ZENO E2E iconpack — regenerates every raster icon from the brand SVGs.
# Sources of truth: favicon.svg (emblem) + og.svg (social card).
# Requires: rsvg-convert, magick (ImageMagick 7).
set -euo pipefail
cd "$(dirname "$0")/.."

ICONS="icons"
ANDROID_RES="apps/android/app/src/main/res"
BG="#07080b"
mkdir -p "$ICONS"

echo "→ web / PWA raster sizes"
for size in 16 32 48 192 512; do
  rsvg-convert -w "$size" -h "$size" favicon.svg -o "$ICONS/icon-$size.png"
done
cp "$ICONS/icon-16.png" "$ICONS/favicon-16.png"
cp "$ICONS/icon-32.png" "$ICONS/favicon-32.png"

echo "→ apple touch icon (180)"
rsvg-convert -w 180 -h 180 favicon.svg -o "$ICONS/apple-touch-icon.png"

echo "→ maskable (safe-zone 66% on full-bleed background)"
for pair in 192:128 512:340; do
  canvas="${pair%%:*}"
  emblem="${pair##*:}"
  tmp="$(mktemp -t zeno-emblem).png"
  rsvg-convert -w "$emblem" -h "$emblem" favicon.svg -o "$tmp"
  magick -size "${canvas}x${canvas}" "xc:$BG" "$tmp" -gravity center -composite \
    "$ICONS/icon-maskable-$canvas.png"
  rm -f "$tmp"
done

echo "→ favicon.ico (16/32/48)"
magick "$ICONS/icon-16.png" "$ICONS/icon-32.png" "$ICONS/icon-48.png" "$ICONS/favicon.ico"

echo "→ social card (1200x630)"
rsvg-convert -w 1200 -h 630 og.svg -o "$ICONS/og-image.png"

echo "→ Android launcher mipmaps (+ round)"
for pair in mdpi:48 hdpi:72 xhdpi:96 xxhdpi:144 xxxhdpi:192; do
  density="${pair%%:*}"
  size="${pair##*:}"
  out="$ANDROID_RES/mipmap-$density"
  mkdir -p "$out"
  rsvg-convert -w "$size" -h "$size" favicon.svg -o "$out/ic_launcher.png"
  magick "$out/ic_launcher.png" \
    \( -size "${size}x${size}" xc:black -fill white \
       -draw "circle $((size / 2)),$((size / 2)) $((size / 2)),1" \) \
    -alpha off -compose CopyOpacity -composite "$out/ic_launcher_round.png"
done

echo "✓ iconpack written to $ICONS/ and $ANDROID_RES/mipmap-*"
