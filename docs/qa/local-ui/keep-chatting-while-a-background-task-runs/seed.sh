#!/bin/zsh
# Builds the scratch project for this case: a fresh board with card #2, and the stand-in
# (stand-in.mjs) answering as Claude Code.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs> <path to stand-in.mjs>
set -e
P=$1 CLI=$2 STAND_IN=$3
# Unset: run from inside Claude Code, `akb raw create` would hand the card that session.
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "导出 CSV" --slug export-csv > /dev/null
node -e '
const fs = require("fs"), f = ".akb/boards/docs/kanban/ui.config.json"
const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {}
j.harness = "claude-code"
j.harnessSettings = { "claude-code": { command: `node ${process.argv[1]}` } }
fs.writeFileSync(f, JSON.stringify(j, null, 2))' "$STAND_IN"
git add -A && git commit -qm init
