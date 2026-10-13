#!/bin/zsh
# Builds the scratch project for this case: six archived cards whose delivery order differs
# from their id order, two delivered the same day and one with no archived date.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
for t in "导出 CSV" "深色模式" "批量移动卡片" "看板支持自定义字体" "卡片搜索" "导入 Trello"; do
  akb raw create --title "$t" > /dev/null
done
for i in 2 3 4 5 6 7; do akb raw archive $i > /dev/null; done
cd docs/kanban/.archive
d() { sed -i '' "s/^archived: .*/archived: $2/" $1-*.md }
d 2 2026-10-10; d 3 2026-10-12; d 5 2026-10-08; d 6 2026-10-12; d 7 2026-10-01
sed -i '' '/^archived:/d' 4-*.md
