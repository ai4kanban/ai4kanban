#!/bin/sh
# The retired compare pages: each old address answers 301 to the same language's home page.
SITE=${SITE:-http://127.0.0.1:4330}
for u in /vs-linear /vs-github-issues /vs-vibe-kanban /zh/vs-vibe-kanban /ja/vs-linear /vs-linear.md; do
  printf '$ curl -sI %s\n' "$u"
  curl -sI -m 15 "$SITE$u" | grep -iE '^(HTTP|location)' | sed "s#$SITE##"
done
