#!/bin/zsh
# Builds the scratch project for this case: a fresh board with #2, a project agent
# `release-notes`, two spec runs already finished and five still working (on the stand-in
# `claude` beside this file, for 30 minutes).
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2 HERE=${0:A:h}
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN PATH=$HERE:$PATH node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q -b main && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "给导出加一个 CSV 选项" --slug export-csv > /dev/null
mkdir -p docs/kanban/agents/release-notes
printf -- '---\nname: release-notes\ndescription: Writes the release notes a card'"'"'s change needs.\nakb:\n  hook: plan\n---\n\nWrite the release notes for the card.\n' > docs/kanban/agents/release-notes/AGENT.md
git add -A && git commit -qm init
for a in copywriting competitor-research; do STANDIN_MS=2000 akb spec $a 2 > /dev/null; done
sleep 8
for a in ui-designer illustrator tech-stack-advisor release-notes email-planner; do STANDIN_MS=1800000 akb spec $a 2 > /dev/null; done
