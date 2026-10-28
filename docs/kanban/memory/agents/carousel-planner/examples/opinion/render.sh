#!/bin/sh
# Render every page per ratio: ./render.sh [3x4 ...]
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
for r in ${@:-3x4}; do
  case $r in 3x4) H=1440 ;; 4x5) H=1350 ;; *) echo "unknown ratio $r"; exit 1 ;; esac
  for p in 1 2 3 4 5 6 7 8; do
    "$CHROME" --headless --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
      --window-size=1080,$H --virtual-time-budget=2000 \
      --screenshot="page-$r-0$p.png" "file://$PWD/pages.html?p=$p" 2>/dev/null
  done
done
