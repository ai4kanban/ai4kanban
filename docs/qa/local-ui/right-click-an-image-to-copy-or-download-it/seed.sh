#!/bin/zsh
# Adds this case's card to a scratch project (installing a fresh board there first if it has
# none): a card holding an `<Asset>` PNG with `alt`, a markdown image served by the board and
# an image from another site. Needs ffmpeg to draw the two PNGs.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
if [[ ! -d docs/kanban ]]; then
  git init -q && git config user.name qa && git config user.email qa@example.com
  akb install > /dev/null && rm -f docs/kanban/setup-checklist.md
fi
ID=$(akb raw create --title "首页配图" --slug home-pictures | head -1)
A=.akb/boards/docs/kanban/assets/$ID && mkdir -p $A
# A flat colour with a dark band, so the two pictures and their copies are told apart at a glance.
png() { ffmpeg -loglevel error -y -f lavfi -i "color=c=${2}:s=${3}" -frames:v 1 \
  -vf "drawbox=x=0:y=ih*2/5:w=iw:h=ih/5:color=black@0.6:t=fill" "$A/$1" }
png board-overview.png 0xF4C95D 1200x675
png flow-diagram.png 0x9BD3C8 900x500
perl -0pi -e 's/\n<one short paragraph.*//s' docs/kanban/todo/$ID-home-pictures.md
cat >> docs/kanban/todo/$ID-home-pictures.md <<BODY

首页换一张看板总览图，正文里的流程图沿用旧图。

## Worth noting

<Asset src=".assets/$ID/board-overview.png" label="看板总览" alt="看板首页：三列卡片，右侧是聊天面板" />

- **流程图**：沿用现在这张。

![流程示意图](/asset-image/$ID/flow-diagram.png)

- **参考**：别家首页的标志图。

![外链标志](https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png)

<!-- agent -->

## Todo
- [ ] 换图
BODY
git add -A && git commit -qm "card $ID" && echo $ID
