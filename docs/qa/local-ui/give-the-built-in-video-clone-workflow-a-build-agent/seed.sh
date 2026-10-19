#!/bin/zsh
# Builds the scratch project for this case: a fresh board whose #2 is planned, ready, and on
# the built-in video-clone workflow.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q -b main && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "把审阅过的片头模板发到共享模板库" --slug publish-the-intro-template --workflow video-clone > /dev/null
perl -0pi -e 's/status: todo/status: ready/; s/<one short paragraph[^\n]*>/片头模板已审阅，发到共享模板库。/; s/- <the concrete steps>/- 上传模板/; s/- \[ \] every task[^\n]*/- [ ] 上传模板/' docs/kanban/todo/2-publish-the-intro-template.md
git add -A && git commit -qm init
