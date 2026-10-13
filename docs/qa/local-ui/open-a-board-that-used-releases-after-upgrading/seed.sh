#!/bin/zsh
# Builds the scratch project for this case: a board an older version left with releases —
# `releases.md` listing v1.2, two open cards and one archived card naming a release, and the
# summary of the closed v1.1.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
for t in "导出 CSV" "深色模式" "卡片搜索"; do akb raw create --title "$t" > /dev/null; done
akb raw archive 4 > /dev/null
K=docs/kanban
rel() { sed -i '' "s/^status: \(.*\)$/status: \1\nrelease: $2/" $1 }
rel $K/todo/2-*.md v1.2; rel $K/todo/3-*.md v1.2; rel $K/.archive/4-*.md v1.1
print -- '# Releases\n\n- v1.2 — 导出与外观\n' > $K/releases.md
mkdir -p $K/.release-summaries
print -- '# v1.1\n\n## Closed 2026-10-01\n\n- #4 卡片搜索\n' > $K/.release-summaries/v1.1.md
git add -A && git commit -qm "old board with releases"
