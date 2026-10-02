#!/bin/sh
# Builds the board this case starts from, with the PREVIOUS version of the command: one real
# triage pull (which seeds "Fetch triage items") and four hand-made cards.
# Run in an empty git project while `node endpoint.mjs 4517` is up:
#   OLD="node <previous version>/cli/bin/ai4kanban.mjs" sh seed.sh
set -e
here=$(cd "$(dirname "$0")" && pwd)
$OLD install >/dev/null
rm -f docs/kanban/setup-checklist.md
mkdir -p docs/kanban/todo/recurring/dependency-notes
echo "- left-pad" > docs/kanban/todo/recurring/dependency-notes/ignore.md
echo "- **Triage endpoint** — http://127.0.0.1:4517/" >> docs/kanban/config.md
echo "TRIAGE_ENDPOINT_TOKEN=stand-in" > docs/kanban/.env
$OLD triage fetch >/dev/null
$OLD raw create --title "Check for dependency updates" --recurring --cadence 7d --body-file "$here/card-dependency-updates.md" >/dev/null
$OLD raw record-run 3 >/dev/null
$OLD raw create --title "Sweep stale branches" --recurring --body-file "$here/card-sweep-stale-branches.md" \
  --question "[user] Delete remote branches too, or only local ones?" --option "Only local" --option "Remote too" >/dev/null
$OLD raw create --title "Upgrade the linter" --related 3 >/dev/null
$OLD raw create --title "Post the weekly summary" --recurring --cadence 7d --body-file "$here/card-weekly-summary.md" >/dev/null
git add -A && git commit -qm "board from the previous version"
