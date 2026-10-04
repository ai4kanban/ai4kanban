W=${W:?the ai4kanban checkout}
C=${Q:?a scratch folder}/case
K=$W/cli/dist/kanban.mjs
e(){ env -i PATH="${Q:?a scratch folder}/bin:/usr/bin:/bin" HOME=${Q:?a scratch folder}/home AI4KANBAN_HOME=${Q:?a scratch folder}/akbhome "$@"; }
s(){ print -r -- "\$ $*"; e "$@" 2>&1; print -r -- "# exit $?"; print; }
cd ${Q:?a scratch folder} && rm -rf r && mkdir r && cd r
e akb install >/dev/null 2>&1
rm -f docs/kanban/setup-checklist.md
mkdir -p docs/kanban/agents/release-notes
cat > docs/kanban/agents/release-notes/AGENT.md <<'X'
---
name: release-notes
description: Adds a line to CHANGELOG.md for each card finished since its last run.
akb:
  hook: schedule
  reads: commits
---

Add one line to `CHANGELOG.md` for each card that landed since your last run; list them with
`akb raw list --archived --since last-run`.
X
node -e '
const f=".akb/boards/docs/kanban/ui.config.json";const fs=require("fs");let c={};try{c=JSON.parse(fs.readFileSync(f))}catch{}
c.harness="claude-code";c.harnessSettings={"claude-code":{command:"node ${Q:?a scratch folder}/case/stand-in.mjs '$W'/cli/bin/ai4kanban.mjs"}};fs.writeFileSync(f,JSON.stringify(c,null,2))'
{
  s ls -a
  s git status
  s sed -n 1,7p docs/kanban/agents/release-notes/AGENT.md
  s akb workflow schedule coding
  print -r -- "$ node tick.mjs"; e node $C/tick.mjs $K 2>&1; print -r -- "# exit $?"; print
} > $C/01-not-git.log
{
  s akb describe-project
  sleep 6
  s akb run list
  s cat docs/kanban/memory/project.md
  print -r -- "$ node tick.mjs"; e node $C/tick.mjs $K 2>&1; print -r -- "# exit $?"; print
} > $C/02-described.log
{
  s akb workflow schedule coding --on release-notes --cadence 1m
  s akb workflow schedule coding --run release-notes
  sleep 6
  s akb run list
  s cat CHANGELOG.md
  s akb workflow schedule coding
} > $C/03-switch-on.log
