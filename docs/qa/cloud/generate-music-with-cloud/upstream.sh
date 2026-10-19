#!/bin/bash
# The stand-in upstream's answers: a 30-second MPEG-1 Layer III track (asked for 10, like the
# real one's overlong answers) and a PNG. Nothing reaches a real provider.
set -e
Q=/tmp/qa-cloud-music
ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=220:duration=30" -f lavfi -i "sine=frequency=330:duration=30" \
  -filter_complex "[0][1]amix=inputs=2,volume=2,aformat=channel_layouts=stereo" -ar 48000 -c:a libmp3lame -b:a 192k \
  -id3v2_version 0 -write_xing 0 $Q/upstream.mp3
ffmpeg -loglevel error -y -f lavfi -i "color=c=0x2b6cb0:s=1024x576:d=1" -frames:v 1 $Q/upstream.png
ls -l $Q/upstream.mp3 $Q/upstream.png | awk '{print $5, $9}'
