#!/bin/zsh
# Adds this case's card to a scratch project (installing a fresh board there first if it has
# none): an 8-second source video, its four-shot breakdown and a clone script that drops S3,
# compared shot by shot; then the finished clone against the source, its bar cut by the
# breakdown. Needs ffmpeg.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
if [[ ! -d docs/kanban ]]; then
  git init -q && git config user.name qa && git config user.email qa@example.com
  akb install > /dev/null && rm -f docs/kanban/setup-checklist.md
fi
ID=$(akb raw create --title "复刻发布会片头：逐镜对照原片和脚本" --slug clone-against-script | head -1)
A=.akb/boards/docs/kanban/assets/$ID && mkdir -p $A
ff() { ffmpeg -loglevel error -y "$@" }
ff -f lavfi -i "testsrc2=s=960x540:r=30:d=8" -f lavfi -i "sine=f=440:d=8" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart $A/source.mp4
ff -i $A/source.mp4 -f lavfi -i "sine=f=660:d=8" -map 0:v -map 1:a -vf "hue=h=90" -c:v libx264 -c:a aac -shortest -pix_fmt yuv420p -movflags +faststart $A/clone.mp4
shot() { printf '{"id":"%s","start":%s,"end":%s,"voiceover":%s,"action":"%s","captions":%s,"details":"%s","frames":[]}' "$@" }
NONE='{"mode":"none"}'
cat > $A/breakdown.json <<JSON
{"version":1,"shots":[
$(shot S1 0 2 $NONE "黑底上标志从中心淡入" '["ACME"]' "标志 30% 宽；0.6 秒缓入"),
$(shot S2 2 4 '{"mode":"spoken","text":"认识全新的 ACME","source":"原片 0:02"}' "标题从左侧滑入" '["认识全新的 ACME"]' "标题 64px 粗体；0.4 秒滑入"),
$(shot S3 4 6 $NONE "三张功能卡依次弹出" '["快","稳","省"]' "每张间隔 0.2 秒；弹性缓动"),
$(shot S4 6 8 $NONE "收尾定格在标志上" '[]' "定格 1.5 秒后淡出")
]}
JSON
cat > $A/clone.json <<JSON
{"version":1,"shots":[
$(shot S1 0 2 $NONE "看板标志从中心淡入" '["AI4Kanban"]' "沿用原片 S1 的节奏"),
$(shot S2 2 4.5 '{"mode":"spoken","text":"把想法交给看板","source":"复刻配音"}' "卡片从待办滑到进行中" '["把想法交给看板"]' "卡片移动 0.5 秒"),
$(shot S4 4.5 6.5 $NONE "收尾定格在看板标志上" '[]' "定格 1 秒")
]}
JSON
perl -0pi -e 's/\n<one short paragraph.*//s' docs/kanban/todo/$ID-clone-against-script.md
cat >> docs/kanban/todo/$ID-clone-against-script.md <<BODY

照着发布会片头做一个模板：先逐镜对照原片和复刻脚本，出片后再对照成片。

## Worth noting

<Compare a=".assets/$ID/source.mp4" b=".assets/$ID/clone.json" shots=".assets/$ID/breakdown.json" label="原片与复刻脚本" a-label="原片拆解" b-label="复刻脚本" />

<Compare a=".assets/$ID/source.mp4" b=".assets/$ID/clone.mp4" shots=".assets/$ID/breakdown.json" label="成片对原片" a-label="原片" b-label="复刻" />

<!-- agent -->

## Todo
- [ ] 核对每个镜头
BODY
git add -A && git commit -qm "card $ID" && echo $ID
