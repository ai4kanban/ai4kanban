#!/bin/bash
# Throwaway PostgreSQL with every cloud migration applied; Pro user and free user seeded.
set -e
Q=/tmp/qa-cloud-music; C=$Q/repo/cloud; D=$Q/pg; PORT=55491
[ -f $D/data/postmaster.pid ] && pg_ctl -D $D/data stop -m fast >/dev/null
rm -rf $D; mkdir -p $D
initdb -D $D/data -U postgres --auth=trust >/dev/null
pg_ctl -D $D/data -o "-p $PORT -k $D -c listen_addresses=''" -l $D/pg.log -w start >/dev/null
run() { psql -q -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 "$@"; }
run -f $C/test/sql/supabase.sql >/dev/null
n=0; for f in $C/migrations/*.sql; do run -f $f >/dev/null; n=$((n+1)); done
run -c "insert into auth.identities (user_id, provider, identity_data) values
 ('22222222-2222-4222-8222-222222222222','github','{\"user_name\":\"pro-user\"}'),
 ('11111111-1111-4111-8111-111111111111','github','{\"user_name\":\"free-user\"}');
 insert into cloud.subscriptions (id, user_id, customer_id, period, status, current_period_end)
 values ('sub_qa','22222222-2222-4222-8222-222222222222','cus_qa','yearly','active', now() + interval '300 days');"
echo "pg: $n migrations applied on port $PORT"
