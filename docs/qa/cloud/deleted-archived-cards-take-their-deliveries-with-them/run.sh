#!/bin/zsh
# 在一次性 PostgreSQL 上重放升级前后：先装到 0037，建好 workspace，用旧函数删一张卡；
# 再应用 0038、0039（升级），再删两张卡。每一步写一份日志到本目录。
set -e
HERE=${0:A:h}
CLOUD=${HERE:h:h:h:h}/cloud
D=$(mktemp -d /tmp/qa-cloud-XXXX)
PORT=55491
initdb -D $D/pg -U postgres --auth=trust >/dev/null 2>&1
pg_ctl -D $D/pg -o "-p $PORT -k $D -c listen_addresses=''" -l $D/pg.log -w start >/dev/null
trap "pg_ctl -D $D/pg -m immediate -w stop >/dev/null; rm -rf $D" EXIT
q() { psql -X -q -h $D -p $PORT -U postgres -v ON_ERROR_STOP=1 "$@"; }
OWNER=00000000-0000-4000-8000-0000000000a1
# GET /workspaces/<id>/deliveries 返回的就是 api.read_deliveries；只留卡号和状态。
show() {
  q -At -c "select coalesce(string_agg(format('  #%s %s', d->>'cardId', d->>'state'), E'\n' order by (d->>'cardId')::int, d->>'state'), '  （无）')
            from json_array_elements(api.read_deliveries('$OWNER', (select id from cloud.workspaces where name = 'QA board'), null)) d"
}
archive() {
  q -At -c "select '  ' || coalesce(string_agg('#' || (c->>'id'), ' ' order by (c->>'id')::int), '（空）')
            from json_array_elements(api.read_archive('$OWNER', (select id from cloud.workspaces where name = 'QA board'))->'cards') c"
}
delete() {
  q -At -c "select api.delete_archived_cards('$OWNER', (select id from cloud.workspaces where name = 'QA board'), '$1', null, '$2'::jsonb, 100000) ->> 'deleted'"
}
step() { print -r -- "\$ $1"; }

q -f $CLOUD/test/sql/supabase.sql >/dev/null
for f in $CLOUD/migrations/*.sql; do
  [[ ${f:t} < 0038 ]] && q -f $f >/dev/null
done
q -f $HERE/seed.sql >/dev/null

{
  print -r -- "# 升级前（迁移装到 0037）。1 号在看板上，2–5 号已归档"
  step "归档"; archive
  step "交付记录"; show
} > $HERE/01-before.log

{
  print -r -- "# 升级前：每日清理删掉到期的 5 号"
  step "删除归档卡片 [5]"; print -r -- "  已删除 $(delete qa-old '[5]')"
  step "归档"; archive
  step "交付记录"; show
} > $HERE/02-old-delete-leaves-records.log

{
  print -r -- "# 升级：应用 0038、0039"
  for f in $CLOUD/migrations/0038_*.sql $CLOUD/migrations/0039_*.sql; do
    q -f $f >/dev/null; step "应用 ${f:t}"
  done
  step "交付记录"; show
} > $HERE/03-upgrade-clears-old-records.log

{
  print -r -- "# 升级后：每日清理删掉到期的 2、3 号，4 号未到期"
  step "删除归档卡片 [2,3]"; print -r -- "  已删除 $(delete qa-new '[2,3]')"
  step "归档"; archive
  step "交付记录"; show
} > $HERE/04-delete-takes-records.log
