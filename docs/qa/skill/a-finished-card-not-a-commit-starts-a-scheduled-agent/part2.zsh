W=${W:?the ai4kanban checkout}
C=${Q:?a scratch folder}/case
K=$W/cli/dist/kanban.mjs
e(){ env -i PATH="${Q:?a scratch folder}/bin:/usr/bin:/bin" HOME=${Q:?a scratch folder}/home AI4KANBAN_HOME=${Q:?a scratch folder}/akbhome "$@"; }
s(){ print -r -- "\$ $*"; e "$@" 2>&1; print -r -- "# exit $?"; print; }
t(){ print -r -- "\$ node tick.mjs"; e node $C/tick.mjs $K 2>&1; print -r -- "# exit $?"; print; }
cd ${Q:?a scratch folder}/r
node -e '
const f=".akb/boards/docs/kanban/ui.config.json";const fs=require("fs");const c=JSON.parse(fs.readFileSync(f));
c.projectDescription={...c.projectDescription,cadence:"1m"};fs.writeFileSync(f,JSON.stringify(c,null,2))'
sleep 70
{
  s date '+%H:%M'
  s akb workflow schedule coding
  t
} > $C/04-a-quiet-minute.log
{
  s git init -q
  e git config user.name qa; e git config user.email qa@example.com
  s git add -A
  s git commit -qm 'Add reading notes'
  s git log --format='%h %s'
  print -r -- '$ sleep 70'; sleep 70; print
  s date '+%H:%M'
  t
} > $C/05-a-commit.log
{
  s akb raw create --title "Export notes as Markdown"
  s akb raw archive 2
  t
} > $C/06-a-finished-card.log
