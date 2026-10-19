#!/bin/bash
# Runs the case's steps against the local Cloud from ../generate-music-with-cloud (pg.sh,
# upstream.sh, server.mjs, mint.mjs, akb.sh) and writes one log per step.
Q=/tmp/qa-cloud-music; P=${1:?proof folder}; H=$(cd "$(dirname "$0")/../generate-music-with-cloud" && pwd)
bash "$H/pg.sh" >/dev/null 2>&1; rm -rf "$P"; mkdir -p "$P"; rm -rf $Q/work; mkdir -p $Q/work; cd $Q/work; rm -f $Q/upstream-down
sql() { psql -h $Q/pg -p 55491 -U postgres -At -c "$1"; }
spends() {
  echo "\$ cloud.credit_spends / cloud.ai_calls (use|credits, capability|ok|cost)"
  sql "select use, credits from cloud.credit_spends order by at" | sed 's/^/spend: /'
  sql "select capability, ok, cost_usd from cloud.ai_calls order by at" | sed 's/^/ai_call: /'
}
akb() { echo "\$ akb $*"; "$H/akb.sh" "$@" 2>&1; echo "(exit $?)"; }
START=$(wc -l < $Q/server.log)

{ AKB_HOME=$Q/free akb cloud image --aspect 16:9 --out cover.png "a calm kanban board at dusk"; ls cover.png 2>&1; } > "$P/01-free.log"

{ akb cloud image --aspect 16:9 --out cover.png "a calm kanban board at dusk"
  echo; echo "\$ file cover.png"; file cover.png; echo; spends; } > "$P/02-generate.log"

touch $Q/upstream-down
{ akb cloud image --aspect 16:9 --out again.png "a calm kanban board at dusk"; ls again.png 2>&1; echo; spends; } > "$P/03-upstream-down.log"
rm -f $Q/upstream-down
tail -n +$((START + 1)) $Q/server.log | grep -v '^POST /v1/music\|rpc ' > "$P/00-worker.log"
