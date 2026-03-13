#!/bin/bash
# Generate PNG icons from SVG. Requires rsvg-convert or ImageMagick.
# Run: bash icons/generate-icons.sh

if command -v rsvg-convert &>/dev/null; then
  rsvg-convert -w 16 -h 16 icons/icon.svg -o icons/icon-16.png
  rsvg-convert -w 48 -h 48 icons/icon.svg -o icons/icon-48.png
  rsvg-convert -w 128 -h 128 icons/icon.svg -o icons/icon-128.png
elif command -v convert &>/dev/null; then
  convert -background none icons/icon.svg -resize 16x16 icons/icon-16.png
  convert -background none icons/icon.svg -resize 48x48 icons/icon-48.png
  convert -background none icons/icon.svg -resize 128x128 icons/icon-128.png
else
  echo "Install rsvg-convert (librsvg2-bin) or ImageMagick to generate PNGs."
  exit 1
fi

echo "Icons generated."
