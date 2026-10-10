#!/bin/zsh
# Adds this case's card to a scratch project (installing a fresh board there first if it has
# none): a 4-second H.264 MP4 embedded twice — once with `loop`, once without — with enough
# text between them to scroll the looping one out of view. Needs ffmpeg.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
if [[ ! -d docs/kanban ]]; then
  git init -q && git config user.name qa && git config user.email qa@example.com
  akb install > /dev/null && rm -f docs/kanban/setup-checklist.md
fi
ID=$(akb raw create --title "首页动图改用视频" --slug loop-video | head -1)
A=.akb/boards/docs/kanban/assets/$ID && mkdir -p $A
# A ball crossing the frame with a running clock, so two frames tell whether it plays.
ffmpeg -loglevel error -y -f lavfi -i "testsrc2=s=960x540:r=30:d=4" -an \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart $A/loop.mp4
cp $A/loop.mp4 $A/walkthrough.mp4
FILLER=$(for i in {1..12}; do print -r -- "- **第 $i 条**：动图改成 MP4 后，体积约为 GIF 的一半；这一行只是为了让页面足够长，可以把视频滚出视野。"; done)
perl -0pi -e 's/\n<one short paragraph.*//s' docs/kanban/todo/$ID-loop-video.md
cat >> docs/kanban/todo/$ID-loop-video.md <<BODY

首页的动图改成循环播放的 MP4。

## Worth noting

<Asset src=".assets/$ID/loop.mp4" label="首页动图" loop />

$FILLER

<Asset src=".assets/$ID/walkthrough.mp4" label="操作录屏" />

<!-- agent -->

## Todo
- [ ] 换成视频
BODY
git add -A && git commit -qm "card $ID" && echo $ID
