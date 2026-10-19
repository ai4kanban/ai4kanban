#!/bin/zsh
# Builds the scratch project for this case: a fresh board with nothing waiting on anyone and
# one planned coding card, #2.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q -b main && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md docs/kanban/todo/1-*.md
perl -ni -e "print unless /1-answer/" docs/kanban/todo/README.md
akb raw create --title "修好设置页的拼写" --slug fix-typo > /dev/null
perl -0pi -e 's/status: todo/status: ready/; s/<one short paragraph[^\n]*>/设置页有一处拼写错误。/; s/- <the concrete steps>/- 改字/; s/- \[ \] every task[^\n]*/- [ ] 改字/' docs/kanban/todo/2-fix-typo.md
git add -A && git commit -qm init
