#!/bin/zsh
# Builds the scratch project for this case: a fresh board with three cards — #2 to remove,
# #3 and #4 with every todo already ticked — and the stand-in as the board's agent.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs> <path to stand-in.mjs>
set -e
P=$1 CLI=$2 STAND_IN=$3
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "加一个深色模式" --slug dark-mode > /dev/null
akb raw create --title "导出 CSV" --slug export-csv > /dev/null
akb raw create --title "修正登录页错别字" --slug login-typo > /dev/null
tick() { perl -0pi -e "s/<one short paragraph[^\n]*>/$2/; s/- <the concrete steps>/- $3/; s/- \[ \] every task[^\n]*/- [x] $4/" docs/kanban/todo/$1 }
tick 3-export-csv.md "列表页可以导出 CSV。" "导出按钮" "核实：功能早已存在"
tick 4-login-typo.md "登录页标题里的错别字已改正。" "登录页标题" "改正「登陆」为「登录」"
node -e '
const fs = require("fs"), f = ".akb/boards/docs/kanban/ui.config.json"
const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {}
j.harness = "claude-code"
j.harnessSettings = { "claude-code": { command: `node ${process.argv[1]} ${process.argv[2]}` } }
fs.writeFileSync(f, JSON.stringify(j, null, 2))' "$STAND_IN" "$CLI"
git add -A && git commit -qm init
