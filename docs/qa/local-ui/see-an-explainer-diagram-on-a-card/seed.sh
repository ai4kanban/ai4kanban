#!/bin/zsh
# Builds the scratch project for this case: a fresh board with card #2, whose software planner
# section is a mermaid diagram, and card #3, whose diagram has a broken header.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "结束讨论时停掉 Agent" --slug end-discussion-stops-agent > /dev/null
akb raw create --title "结束讨论时停掉 Agent（草稿）" --slug end-discussion-draft > /dev/null
body() { # <card file> <mermaid header>: keeps the frontmatter, writes the rest
  awk 'f < 2 { print } /^---$/ { f++ }' "$1" > "$1.new"
  cat >> "$1.new" <<CARD

点「结束讨论」后，它背后的 Agent 和 Agent 起的后台进程一起结束。

## Worth noting

- **正在写的回复会被截断**：结束即停止。

## By \`software-planner\` agent

\`\`\`mermaid
$2
  A[用户点「结束讨论」] --> B{还有回复或后台任务？}
  B -->|有| C[停掉 Agent]
  B -->|没有| D[只归档对话]
  C --> E[清理 Agent 起的进程]
  E --> D
\`\`\`

<!-- agent -->

## Scope

- **结束即停止**：结束讨论时停掉它的 Agent，并清理 Agent 起的进程。

## Todo

- [ ] 结束讨论时停掉 Agent

## Decided by the agent

### Overruled by the user
CARD
  mv "$1.new" "$1"
}
body docs/kanban/todo/2-end-discussion-stops-agent.md "flowchart TB"
body docs/kanban/todo/3-end-discussion-draft.md "flowchar TB"
git add -A && git commit -qm init
