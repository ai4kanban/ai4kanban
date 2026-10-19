#!/bin/bash
# Throwaway PostgreSQL with every cloud migration applied, on its own port.
set -e
Q=/tmp/qa-cloud-cat; C=$Q/repo/cloud; D=$Q/pg; PORT=55474
rm -rf $D; mkdir -p $D
initdb -D $D/data -U postgres --auth=trust >/dev/null
pg_ctl -D $D/data -o "-p $PORT -k $D -c listen_addresses=''" -l $D/pg.log -w start >/dev/null
run() { psql -q -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 "$@"; }
run -f $C/test/sql/supabase.sql >/dev/null
n=0; for f in $C/migrations/*.sql; do run -f $f >/dev/null; n=$((n+1)); done
run -c "insert into auth.identities (user_id, provider, identity_data) values
 ('33333333-3333-4333-8333-333333333333','github','{\"user_name\":\"neverchanje\"}'),
 ('11111111-1111-4111-8111-111111111111','github','{\"user_name\":\"lin\"}');"
echo "pg: $n migrations applied on port $PORT"
