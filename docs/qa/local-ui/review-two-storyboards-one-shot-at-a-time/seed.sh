#!/bin/zsh
# Adds this case's card to a scratch project (installing a fresh board there first if it has
# none): a source breakdown with one picture per shot (one of them portrait) and a clone
# script with a start and end frame per shot, its last shot with no pictures. Needs ffmpeg.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
if [[ ! -d docs/kanban ]]; then
  git init -q && git config user.name qa && git config user.email qa@example.com
  akb install > /dev/null && rm -f docs/kanban/setup-checklist.md
fi
ID=$(akb raw create --title "复刻发布会片头：先审两份分镜" --slug clone-drafts | head -1)
A=.akb/boards/docs/kanban/assets/$ID && mkdir -p $A
# A flat colour with k white squares, so a frame tells its shot number; an end frame is lighter.
png() { local f="" i; for i in $(seq 1 $4); do f+="drawbox=x=$((i*140-40)):y=100:w=100:h=100:color=white:t=fill,"; done
  ffmpeg -loglevel error -y -f lavfi -i "color=c=${2}:s=${3}" -frames:v 1 -vf "${f%,}" "$A/$1" }
png s1.png 0x1D3557 1280x720 1
png s2.png 0x457B9D 1280x720 2
png s3.png 0xE63946 720x1280 3
png s4.png 0x2A9D8F 1280x720 4
png s5.png 0x264653 1280x720 5
for k in 1 2 3; do png c$k-a.png 0x6D597A 1280x720 $k; png c$k-b.png 0xB56576 1280x720 $k; done
f() { printf '{"src":".assets/%s/%s","alt":"%s"}' $ID "$1" "$2" }
shot() { printf '{"id":"%s","start":%s,"end":%s,"voiceover":%s,"action":"%s","captions":%s,"details":"%s","frames":[%s]}' "$@" }
NONE='{"mode":"none"}'
cat > $A/breakdown.json <<JSON
{"version":1,"shots":[
$(shot S1 0 2 $NONE "黑底上标志从中心淡入" '["ACME"]' "居中构图，标志 30% 宽；0.6 秒缓入；低频鼓点起" "$(f s1.png 标志淡入)"),
$(shot S2 2 4.5 '{"mode":"spoken","text":"认识全新的 ACME","source":"原片 0:02"}' "标题从左侧滑入，背景渐亮" '["认识全新的 ACME"]' "标题 64px 粗体；从 -200px 滑入，0.4 秒" "$(f s2.png 标题滑入)"),
$(shot S3 4.5 6 $NONE "竖版手机画面上推入场" '[]' "竖版素材居中；上推 0.5 秒" "$(f s3.png 手机竖屏)"),
$(shot S4 6 8 $NONE "三张功能卡依次弹出" '["快","稳","省"]' "每张间隔 0.2 秒；弹性缓动" "$(f s4.png 功能卡)"),
$(shot S5 8 10 $NONE "收尾定格在标志上" '[]' "定格 1.5 秒后淡出" "$(f s5.png 收尾定格)")
]}
JSON
cat > $A/clone.json <<JSON
{"version":1,"shots":[
$(shot S1 0 2 $NONE "看板标志从中心淡入" '["AI4Kanban"]' "沿用原片 S1 的节奏" "$(f c1-a.png C1 起始),$(f c1-b.png C1 结束)"),
$(shot S2 2 4.5 '{"mode":"spoken","text":"把想法交给看板","source":"复刻配音"}' "标题滑入，卡片从待办移到进行中" '["把想法交给看板"]' "卡片移动 0.5 秒" "$(f c2-a.png C2 起始),$(f c2-b.png C2 结束)"),
$(shot S3 4.5 7 $NONE "Agent 规划卡片，草稿逐条出现" '[]' "三行草稿每行间隔 0.3 秒" "$(f c3-a.png C3 起始),$(f c3-b.png C3 结束)"),
$(shot S4 7 9 $NONE "收尾定格在看板标志上" '[]' "画面还没做" "")
]}
JSON
perl -0pi -e 's/\n<one short paragraph.*//s' docs/kanban/todo/$ID-clone-drafts.md
cat >> docs/kanban/todo/$ID-clone-drafts.md <<BODY

照着发布会片头做一个模板，先审原片拆解和复刻脚本。

## Worth noting

<Storyboard src=".assets/$ID/breakdown.json" label="原片拆解" />

<Storyboard src=".assets/$ID/clone.json" label="AI4Kanban 复刻" />

<!-- agent -->

## Todo
- [ ] 确认两份分镜
BODY
git add -A && git commit -qm "card $ID" && echo $ID
