#!/bin/zsh
# Builds the scratch project: a fresh board with one card (#2) and the stand-in as the board's agent.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs> <path to stand-in.mjs>
set -e
P=$1 CLI=$2 STAND_IN=$3
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "导出 CSV" --slug export-csv > /dev/null
perl -0pi -e "s/<one short paragraph[^\n]*>/列表页可以把当前筛选结果导出成 CSV。/" docs/kanban/todo/2-export-csv.md
node -e '
const fs = require("fs"), f = ".akb/boards/docs/kanban/ui.config.json"
const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {}
j.harness = "claude-code"
j.harnessSettings = { "claude-code": { command: `node ${process.argv[1]} ${process.argv[2]}` } }
fs.writeFileSync(f, JSON.stringify(j, null, 2))' "$STAND_IN" "$CLI"
git add -A && git commit -qm init
