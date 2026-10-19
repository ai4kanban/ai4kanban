#!/bin/zsh
# Builds the scratch project for this case: #2 is a blog-post card sitting on its outline stage
# with the outline on the card — the card that should have been a coding card.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q -b main && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "给设置页加一个导出按钮" --slug export-button --workflow blog-post > /dev/null
perl -0pi -e 's/status: todo/status: ready/; s/<one short paragraph[^\n]*>/设置页加一个按钮，把看板导出成 zip。/; s/- <the concrete steps>/- 写文章/; s/- \[ \] every task[^\n]*/- [ ] 交付文章/' docs/kanban/todo/2-export-button.md
mkdir -p .akb/boards/docs/kanban/assets/2
printf '# 大纲\n\n1. 为什么要导出\n2. 怎么导出\n' > .akb/boards/docs/kanban/assets/2/outline.md
perl -0pi -e 's/(## Worth noting\n)/$1\n<Asset src=".assets\/2\/outline.md" label="大纲" \/>\n/' docs/kanban/todo/2-export-button.md
akb raw update 2 --phases "大纲,文章" --phase 1 > /dev/null
git add -A && git commit -qm init
