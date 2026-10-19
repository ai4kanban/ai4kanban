#!/bin/sh
# akb as a user on this machine: clean env, scratch home, pointed at the local Cloud.
H=${AKB_HOME:-/tmp/qa-cloud-cat/home}
exec env -i PATH=/tmp/qa-cloud-cat/bin:/usr/bin:/bin:/opt/homebrew/bin HOME=/tmp/qa-cloud-cat/empty AI4KANBAN_HOME=$H \
  AI4KANBAN_CLOUD_URL=http://127.0.0.1:8794 AI4KANBAN_SUPABASE_URL=http://127.0.0.1:8794 AI4KANBAN_SUPABASE_ANON_KEY=anon akb "$@"
