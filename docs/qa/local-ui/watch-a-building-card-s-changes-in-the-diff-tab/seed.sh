#!/bin/zsh
# Builds the scratch project: a fresh board, a README.md in the first commit, card #2 with its
# plan written, and the stand-in as the board's agent.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs> <path to stand-in.mjs>
set -e
P=$1 CLI=$2 STAND_IN=$3
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q -b main && git config user.name qa && git config user.email qa@example.com
print -r -- '# Lists' > README.md
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "导出 CSV" --slug export-csv > /dev/null
perl -0pi -e 's/<one short paragraph[^\n]*>/列表页可以把当前列表导出成 CSV。/; s/- <the concrete steps>/- 列表页加「Export CSV」按钮/; s/- \[ \] every task[^\n]*/- [ ] 写 src\/export-csv.js 并在 README 里说明/' docs/kanban/todo/2-export-csv.md
node -e '
const fs = require("fs"), f = ".akb/boards/docs/kanban/ui.config.json"
const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {}
j.harness = "claude-code"
j.harnessSettings = { "claude-code": { command: `node ${process.argv[1]}` } }
fs.writeFileSync(f, JSON.stringify(j, null, 2))' "$STAND_IN"
git add -A && git commit -qm init
