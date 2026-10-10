#!/bin/zsh
# Builds the scratch project: a fresh board with card #2, written from a discussion. The
# discussion and the card's handoff (seed-chat.mjs) are written by hand, since writing cards
# from a discussion needs a real agent.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs> <path to seed-chat.mjs>
set -e
P=$1 CLI=$2 CHAT=$3
# Unset: run from inside Claude Code, `akb raw create` would hand the card that session.
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "导出 CSV" --slug export-csv > /dev/null
node "$CHAT" .akb/boards/docs/kanban/chats
# Marks the board's own "describe the project" run as done today, so opening the board starts no agent.
node -e '
const fs = require("fs"), f = ".akb/boards/docs/kanban/ui.config.json"
const j = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {}
const d = new Date(), p = (n) => String(n).padStart(2, "0")
j.projectDescription = { lastRun: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}` }
fs.writeFileSync(f, JSON.stringify(j, null, 2))'
git add -A && git commit -qm init
