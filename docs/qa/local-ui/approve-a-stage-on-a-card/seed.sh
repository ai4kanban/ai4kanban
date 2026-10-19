#!/bin/zsh
# Builds the scratch project for this case: three blog-post cards — #2 has its outline drafted
# and waits on approval, #3 on the same stage still has a question for the user, #4 is a
# coding card with no stages.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q -b main && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
fill() { WHAT=$2 perl -0pi -e 's/status: todo/status: ready/; s/<one short paragraph[^\n]*>/$ENV{WHAT}/; s/- <the concrete steps>/- 写文章/; s/- \[ \] every task[^\n]*/- [ ] 交付文章/' docs/kanban/todo/$1-*.md }
akb raw create --title "写一篇介绍看板的博客" --slug board-blog --workflow blog-post > /dev/null
fill 2 "介绍看板怎么把想法变成卡片。"
mkdir -p .akb/boards/docs/kanban/assets/2
printf '# 大纲\n\n1. 想法写成卡片\n2. Agent 规划\n3. 交付与归档\n' > .akb/boards/docs/kanban/assets/2/outline.md
perl -0pi -e 's/(## Worth noting\n)/$1\n<Asset src=".assets\/2\/outline.md" label="大纲" \/>\n/' docs/kanban/todo/2-board-blog.md
akb raw update 2 --phases "大纲,文章" --phase 1 > /dev/null
akb raw create --title "写一篇讲定期 Agent 的博客" --slug scheduled-blog --workflow blog-post > /dev/null
fill 3 "介绍定期运行的 Agent。"
akb raw update 3 --phases "大纲,文章" --phase 1 > /dev/null
akb raw update-questions 3 --append "[user] 文章面向谁？" --option "第一次用看板的人" --option "已经在用的团队" > /dev/null
akb raw create --title "修好设置页的拼写" --slug fix-typo > /dev/null
fill 4 "设置页有一处拼写错误。"
git add -A && git commit -qm init
