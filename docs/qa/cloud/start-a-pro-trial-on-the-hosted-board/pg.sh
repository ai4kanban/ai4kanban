#!/bin/bash
# Throwaway PostgreSQL with every cloud migration applied: one account that never had Pro, one
# whose trial ended yesterday.
set -e
Q=/tmp/qa-cloud-trial; C=$Q/repo/cloud; D=$Q/pg; PORT=55492
[ -f $D/data/postmaster.pid ] && pg_ctl -D $D/data stop -m fast >/dev/null
rm -rf $D; mkdir -p $D
initdb -D $D/data -U postgres --auth=trust >/dev/null 2>&1
pg_ctl -D $D/data -o "-p $PORT -k $D -c listen_addresses=''" -l $D/pg.log -w start >/dev/null
run() { psql -q -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 "$@"; }
run -f $C/test/sql/supabase.sql >/dev/null
n=0; for f in $C/migrations/*.sql; do run -f $f >/dev/null; n=$((n+1)); done
run -c "insert into auth.identities (user_id, provider, identity_data) values
 ('44444444-4444-4444-8444-444444444444','github','{\"user_name\":\"new-user\",\"full_name\":\"New User\"}'),
 ('55555555-5555-4555-8555-555555555555','github','{\"user_name\":\"tried-user\",\"full_name\":\"Tried User\"}');
 insert into cloud.admitted_accounts (handle) values ('new-user'), ('tried-user');
 insert into cloud.pro_trials (user_id, starts_at, ends_at)
 values ('55555555-5555-4555-8555-555555555555', now() - interval '8 days', now() - interval '1 day');"
echo "pg: $n migrations applied on port $PORT"
