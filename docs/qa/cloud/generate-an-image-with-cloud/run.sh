#!/bin/bash
# Runs the case's steps against the local Cloud from ../generate-music-with-cloud (pg.sh,
# upstream.sh, server.mjs, mint.mjs, akb.sh) and writes one log per step.
Q=/tmp/qa-cloud-music; P=${1:?proof folder}; H=$(cd "$(dirname "$0")/../generate-music-with-cloud" && pwd)
bash "$H/pg.sh" >/dev/null 2>&1; rm -rf "$P"; mkdir -p "$P"; rm -rf $Q/work; mkdir -p $Q/work; cd $Q/work; rm -f $Q/upstream-down
for u in home:22222222-2222-4222-8222-222222222222 free:11111111-1111-4111-8111-111111111111 trial:33333333-3333-4333-8333-333333333333; do
  node "$H/mint.mjs" $Q/${u%%:*} ${u#*:}; done
sql() { psql -h $Q/pg -p 55491 -U postgres -At -c "$1"; }
spends() { U=${1:-22222222-2222-4222-8222-222222222222}
  echo "\$ cloud.credit_spends / cloud.ai_calls (use|credits, capability|ok|cost)"
  sql "select use, credits from cloud.credit_spends where user_id = '$U' order by at" | sed 's/^/spend: /'
  sql "select capability, ok, cost_usd from cloud.ai_calls where user_id = '$U' order by at" | sed 's/^/ai_call: /'
}
akb() { echo "\$ akb $*"; "$H/akb.sh" "$@" 2>&1; echo "(exit $?)"; }
START=$(wc -l < $Q/server.log)

{ AKB_HOME=$Q/free akb cloud image --aspect 16:9 --out cover.png "a calm kanban board at dusk"; ls cover.png 2>&1; } > "$P/01-free.log"

{ akb cloud image --aspect 16:9 --out cover.png "a calm kanban board at dusk"
  echo; echo "\$ file cover.png"; file cover.png; echo; spends; } > "$P/02-generate.log"

touch $Q/upstream-down
{ akb cloud image --aspect 16:9 --out again.png "a calm kanban board at dusk"; ls again.png 2>&1; echo; spends; } > "$P/03-upstream-down.log"
rm -f $Q/upstream-down
{ AKB_HOME=$Q/trial akb cloud image --aspect 16:9 --out trial.png "a calm kanban board at dusk"; ls trial.png 2>&1; echo; spends 33333333-3333-4333-8333-333333333333; } > "$P/04-trial-used-up.log"
tail -n +$((START + 1)) $Q/server.log | grep -v '^POST /v1/music\|rpc ' > "$P/00-worker.log"
