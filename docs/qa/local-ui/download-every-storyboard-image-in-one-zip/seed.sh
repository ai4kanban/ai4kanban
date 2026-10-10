#!/bin/zsh
# Adds this case's card to a scratch project (installing a fresh board there first if it has
# none): a four-page carousel storyboard whose page 3 has no picture yet, plus a second
# storyboard with no pictures at all. Needs ffmpeg to draw the pages.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
if [[ ! -d docs/kanban ]]; then
  git init -q && git config user.name qa && git config user.email qa@example.com
  akb install > /dev/null && rm -f docs/kanban/setup-checklist.md
fi
ID=$(akb raw create --title "小红书轮播图：五分钟上手看板" --slug carousel | head -1)
A=.akb/boards/docs/kanban/assets/$ID && mkdir -p $A/previews
# Page k is a flat colour with k black squares, so a page tells its own number.
png() { local f="" i; for i in $(seq 1 $3); do f+="drawbox=x=$((i*110-60)):y=350:w=80:h=80:color=black:t=fill,"; done
  ffmpeg -loglevel error -y -f lavfi -i "color=c=${2}:s=600x800" -frames:v 1 -vf "${f%,}" "$A/previews/$1" }
png 1-cover.png 0xF4C95D 1
png 2-board.png 0x9BD3C8 2
png 4-end.png 0xF2A7A0 4
slide() { printf '{"id":"%s","title":"%s","copy":["%s"],"layout":"%s","assets":[],"preview":{"src":".assets/%s/previews/%s","alt":"%s"}}' "$@" }
cat > $A/carousel.json <<JSON
{"version":1,"slides":[
$(slide cover 封面 五分钟上手看板 cover $ID 1-cover.png 封面),
$(slide board 看板 三列：待办、进行中、完成 split $ID 2-board.png 看板三列),
$(slide chat 聊天 "和 Agent 讨论一张卡" split $ID 3-chat.png 聊天面板),
$(slide end 结尾 关注获取更多 cover $ID 4-end.png 结尾页)
]}
JSON
cat > $A/draft.json <<JSON
{"version":1,"slides":[
$(slide cover 封面 草稿 cover $ID draft-1.png 草稿封面),
$(slide end 结尾 草稿 cover $ID draft-2.png 草稿结尾)
]}
JSON
perl -0pi -e 's/\n<one short paragraph.*//s' docs/kanban/todo/$ID-carousel.md
cat >> docs/kanban/todo/$ID-carousel.md <<BODY

一组四页的小红书轮播图，第 3 页还没出图。

## Worth noting

<Storyboard src=".assets/$ID/carousel.json" label="小红书 3:4" />

<Storyboard src=".assets/$ID/draft.json" label="草稿" />

<!-- agent -->

## Todo
- [ ] 补第 3 页
BODY
git add -A && git commit -qm "card $ID" && echo $ID
