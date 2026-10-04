#!/bin/zsh
# Builds the scratch project: a fresh board, cards #2–#4 that one discussion was written into,
# then #3 archived and #4 rejected; the discussion's record (seed-chat.mjs) is written by hand,
# since writing cards from a discussion needs a real agent.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs> <path to seed-chat.mjs>
set -e
P=$1 CLI=$2 CHAT=$3
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "导出 CSV" --slug export-csv > /dev/null
akb raw create --title "导出时带上表头" --slug csv-header > /dev/null
akb raw create --title "导出为 Excel" --slug export-excel > /dev/null
akb raw archive 3 > /dev/null
akb raw reject 4 --discard > /dev/null
node "$CHAT" .akb/boards/docs/kanban/chats
git add -A && git commit -qm init
