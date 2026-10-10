#!/bin/zsh
# Builds the scratch project for this case: a fresh board, one card (#2) and one project agent,
# `release-notes`, that names no global memory yet.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>
set -e
P=$1 CLI=$2
akb() { node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "写 1.2 版的发布说明" --slug release-notes-1-2 > /dev/null
mkdir -p docs/kanban/agents/release-notes
cat > docs/kanban/agents/release-notes/AGENT.md <<'MD'
---
name: release-notes
description: Use when a card ships something users will notice.
akb:
  hook: plan
  i18n:
    zh:
      title: 发布说明
      description: 卡片上线了用户能感知的改动时使用。
---

You write the release note for the card: one line a user reads in the changelog.
MD
git add -A && git commit -qm init
