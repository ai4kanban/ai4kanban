#!/bin/sh
# Builds the board this case starts from, with the PREVIOUS version of the command (before #1671):
# releases v1 and v2, a card in each, the v1 card archived, and v1 closed with a changelog.
# Run in an empty git project:
#   OLD="node <previous version>/cli/bin/ai4kanban.mjs" sh seed.sh
set -e
$OLD install >/dev/null
rm -f docs/kanban/setup-checklist.md
$OLD raw release new v1 --goal "Sign-in works" >/dev/null
$OLD raw release new v2 --goal "Export" >/dev/null
$OLD raw create --title "Fix the login redirect" --release v1 >/dev/null
$OLD raw create --title "Export to PDF" --release v2 >/dev/null
$OLD raw archive 2 >/dev/null
# KANBAN_RUN keeps the close from starting a real agent run to write the changelog; it is
# written by hand on the next line instead.
KANBAN_RUN=seed $OLD raw release close v1 >/dev/null
$OLD raw release changelog v1 --text "Logging in takes you back to the page you came from." >/dev/null
git add -A && git commit -qm "board from the previous version"
