#!/bin/zsh
# Builds the scratch project for this case: a fresh board with #5 on the video-clone workflow.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
for i in 2 3 4; do akb raw create --title "占位 $i" --slug "filler-$i" > /dev/null; akb raw reject $i --discard > /dev/null; done
akb raw create --title "照着发布会片头做一个模板" --slug clone-the-launch-intro --workflow video-clone > /dev/null
git add -A && git commit -qm init
