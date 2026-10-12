#!/bin/zsh
# Builds the scratch project for this case: a set-up board whose cards were last written
# 0, 7 and 12 days ago, and a group whose root and subtasks were last written 20 and 8 days ago.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
# Drop setup's own seed card: only this case's cards are on the board.
rm docs/kanban/todo/1-*.md && sed -i '' '/^- \[#1 /d' docs/kanban/todo/README.md
cat > docs/kanban/modules.md <<'MD'
# Modules

- **web** — the site users open.
- **api** — the server behind it.
MD
akb raw create --title "导出 CSV" --slug export-csv --modules web > /dev/null
akb raw create --title "深色模式" --slug dark-mode --modules web > /dev/null
akb raw create --title "批量导入" --slug bulk-import --modules api > /dev/null
akb raw update 2 --status ready > /dev/null
akb raw update 4 --status ready > /dev/null
akb raw create --title "账号设置" --slug account-settings --modules web > /dev/null
akb raw create --title "修改头像" --slug change-avatar --modules web --related 5 > /dev/null
akb raw create --title "修改密码" --slug change-password --modules web --related 5 > /dev/null
# Make #5 a group of #6 and #7 (akb guide board, "Group task").
T=docs/kanban/todo
akb raw update 5 --related 6,7 > /dev/null
mkdir $T/5-account
mv $T/5-account-settings.md $T/5-account/root.md
mv $T/6-change-avatar.md $T/7-change-password.md $T/5-account/
perl -0pi -e 's/- \[ \] every task must have todos.*\n/- [ ] 修改头像 #6\n- [ ] 修改密码 #7\n/' $T/5-account/root.md
sed -i '' -e 's#(5-account-settings.md)#(5-account/root.md)#' -e 's#(6-change-avatar.md)#(5-account/6-change-avatar.md)#' -e 's#(7-change-password.md)#(5-account/7-change-password.md)#' $T/README.md
# Back-date each card file: the board reads a card's last write from its mtime.
age() { node -e 'const fs=require("fs");const t=new Date(Date.now()-process.argv[1]*86400000-3600000);for(const f of process.argv.slice(2))fs.utimesSync(f,t,t)' "$@" }
age 12 $T/3-dark-mode.md
age 7 $T/4-bulk-import.md
age 20 $T/5-account/root.md $T/5-account/6-change-avatar.md
age 8 $T/5-account/7-change-password.md
git add -A && git commit -qm init
