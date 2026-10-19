#!/bin/sh
# akb as a user on this machine: clean env, scratch home, pointed at the local Cloud.
H=${AKB_HOME:-/tmp/qa-cloud-music/home}
exec env -i PATH=/tmp/qa-cloud-music/bin:/usr/bin:/bin:/opt/homebrew/bin HOME=/tmp/qa-cloud-music/empty AI4KANBAN_HOME=$H \
  AI4KANBAN_CLOUD_URL=http://127.0.0.1:8795 AI4KANBAN_SUPABASE_URL=http://127.0.0.1:8795 AI4KANBAN_SUPABASE_ANON_KEY=anon akb "$@"
