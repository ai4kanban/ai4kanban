#!/bin/bash
# Runs the case's steps against the local Cloud (server.mjs) and writes one log per step.
Q=/tmp/qa-cloud-music; P=${1:?proof folder}; H=$(cd "$(dirname "$0")" && pwd)
bash "$H/pg.sh" >/dev/null 2>&1; rm -rf "$P"; mkdir -p "$P"; rm -rf $Q/work; mkdir -p $Q/work; cd $Q/work; rm -f $Q/upstream-down
for u in home:22222222-2222-4222-8222-222222222222 free:11111111-1111-4111-8111-111111111111 trial:33333333-3333-4333-8333-333333333333; do
  node "$H/mint.mjs" $Q/${u%%:*} ${u#*:}; done
sql() { psql -h $Q/pg -p 55491 -U postgres -At -c "$1"; }
spends() { U=${1:-22222222-2222-4222-8222-222222222222}
  echo "\$ cloud.credit_spends / cloud.ai_calls (use|credits, capability|ok|seconds|cost)"
  sql "select use, credits from cloud.credit_spends where user_id = '$U' order by at" | sed 's/^/spend: /'
  sql "select capability, ok, usage, cost_usd from cloud.ai_calls where user_id = '$U' order by at" | sed 's/^/ai_call: /'
}
akb() { echo "\$ akb $*"; "$H/akb.sh" "$@" 2>&1; echo "(exit $?)"; }
vendor() { grep -inE 'lyria|google|openrouter' "$1" && echo "!! vendor named" || echo "(no vendor or model name in the output)"; }

{ AKB_HOME=$Q/free akb cloud music --seconds 10 --out cowork.mp3 "warm lo-fi, 74 BPM, soft keys"; ls cowork.mp3 2>&1; } > "$P/01-free.log"

{ akb cloud music --seconds 10 --out cowork.mp3 "warm lo-fi, 74 BPM, soft keys"
  echo; echo "\$ ffprobe cowork.mp3"; ffprobe -v error -show_entries format=format_name,duration -of default=nw=1 cowork.mp3
  echo "upstream answer: $(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 $Q/upstream.mp3)s"
  for r in "0 1.5" "7 1.5" "8.5 0.75" "9.25 0.75"; do set -- $r; echo "mean volume ${1}s +${2}s: $(ffmpeg -nostats -ss $1 -t $2 -i cowork.mp3 -af volumedetect -f null - 2>&1 | sed -n 's/.*mean_volume: //p')"; done
  echo; spends
} > "$P/02-generate.log"
ffmpeg -loglevel error -y -i cowork.mp3 -filter_complex "showwavespic=s=1200x240:colors=0x2b6cb0" -frames:v 1 "$P/02-waveform.png"

{ akb cloud music --seconds 3 --out short.mp3 "warm lo-fi"
  echo; akb cloud music --seconds 10 --out long.mp3 "$(printf 'x%.0s' $(seq 4001))" | cut -c1-200
  echo; ls short.mp3 long.mp3 2>&1; } > "$P/03-bad-input.log"
vendor "$P/03-bad-input.log" >> "$P/03-bad-input.log"

touch $Q/upstream-down
{ akb cloud music --seconds 10 --out again.mp3 "warm lo-fi, 74 BPM"; ls again.mp3 2>&1; echo; spends; } > "$P/04-upstream-down.log"
vendor "$P/04-upstream-down.log" >> "$P/04-upstream-down.log"
rm -f $Q/upstream-down
{ AKB_HOME=$Q/trial akb cloud music --seconds 10 --out trial.mp3 "warm lo-fi, 74 BPM"; ls trial.mp3 2>&1; echo; spends 33333333-3333-4333-8333-333333333333; } > "$P/05-trial-used-up.log"
{ cat $Q/server.log; } > "$P/00-worker.log"
