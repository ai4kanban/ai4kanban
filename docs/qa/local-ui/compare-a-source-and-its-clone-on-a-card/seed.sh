#!/bin/zsh
# Adds this case's card to a scratch project (installing a fresh board there first if it has
# none): a 6-second landscape source video beeping at 440 Hz and its clone (hue shifted, at
# 660 Hz) compared with a three-shot list, two landscape images and two portrait images.
# Needs ffmpeg.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
if [[ ! -d docs/kanban ]]; then
  git init -q && git config user.name qa && git config user.email qa@example.com
  akb install > /dev/null && rm -f docs/kanban/setup-checklist.md
fi
ID=$(akb raw create --title "对比发布会片头的原片和复刻" --slug compare-intro | head -1)
A=.akb/boards/docs/kanban/assets/$ID && mkdir -p $A
ff() { ffmpeg -loglevel error -y "$@" }
ff -f lavfi -i "testsrc2=s=960x540:r=30:d=6" -f lavfi -i "sine=f=440:d=6" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart $A/source.mp4
ff -i $A/source.mp4 -f lavfi -i "sine=f=660:d=6" -map 0:v -map 1:a -vf "hue=h=90" -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p -movflags +faststart $A/clone.mp4
ff -ss 1 -i $A/source.mp4 -frames:v 1 $A/source.png
ff -ss 1 -i $A/clone.mp4 -frames:v 1 $A/clone.png
ff -f lavfi -i "testsrc=s=540x960:d=1" -frames:v 1 $A/phone-source.png
ff -i $A/phone-source.png -vf "hue=h=180" $A/phone-clone.png
cat > $A/shots.json <<'JSON'
[
  { "id": "S1", "start": 0, "end": 2, "name": "标志淡入" },
  { "id": "S2", "start": 2, "end": 4.5, "name": "标题滑入" },
  { "id": "S3", "start": 4.5, "end": 6, "name": "收尾定格" }
]
JSON
perl -0pi -e 's/\n<one short paragraph.*//s' docs/kanban/todo/$ID-compare-intro.md
cat >> docs/kanban/todo/$ID-compare-intro.md <<BODY

把复刻和原片放在一起看。

## Worth noting

<Compare a=".assets/$ID/source.mp4" b=".assets/$ID/clone.mp4" label="原片与复刻" a-label="原片" b-label="复刻" shots=".assets/$ID/shots.json" />

<Compare a=".assets/$ID/source.png" b=".assets/$ID/clone.png" label="第 1 秒" a-label="原片" b-label="复刻" />

<Compare a=".assets/$ID/phone-source.png" b=".assets/$ID/phone-clone.png" label="竖版封面" />

<!-- agent -->

## Todo
- [ ] 核对每个镜头
BODY
git add -A && git commit -qm "card $ID" && echo $ID
