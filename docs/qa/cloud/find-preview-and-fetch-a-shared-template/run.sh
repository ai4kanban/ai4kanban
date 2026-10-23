#!/bin/bash
# Runs the case against the local Cloud: pg.sh, then server.mjs, publishes the two templates as
# the maintainer, then every step as a free account; one log per step in $1.
# $2: templates/ui/hero-tilted-screen from the main checkout (not in git); $3: a folder with its
# rendered preview (hero-preview.jpg) and the Supahero screenshot (supahero.jpg).
Q=/tmp/qa-cloud-tpl; P=${1:?proof folder}; H=$(cd "$(dirname "$0")" && pwd); SRC=${2:?template folder}
bash "$H/pg.sh" > $Q/pg.out 2>&1 || { cat $Q/pg.out; exit 1; }
node "$H/server.mjs" > $Q/server.log 2>&1 & echo $! > $Q/server.pid
until grep -q listening $Q/server.log; do sleep 0.3; done
rm -rf $Q/work $Q/home $Q/maint; mkdir -p $Q/work/extra $Q/work/hero-pro; cd $Q/work
node "$H/mint.mjs" $Q/maint 33333333-3333-4333-8333-333333333333
node "$H/mint.mjs" $Q/home 11111111-1111-4111-8111-111111111111

cp -R "$SRC" hero-tilted-screen
ffmpeg -loglevel error -y -i "$3/hero-preview.jpg" extra/cover.png
cwebp -quiet -q 80 "$3/supahero.jpg" -o extra/linear.webp
ffmpeg -loglevel error -y -f lavfi -i "color=c=0x3b2a6b:s=1200x675:d=1" -frames:v 1 extra/glow.png
printf '# Capture\n\nSupahero screenshot of linear.app, downloaded 2026-10-16.\n' > extra/capture.md
cat > hero-pro/template.md <<'EOF'
---
name: hero-centered-glow
category: ui
tags: [hero, saas]
title: Centered headline over a soft glow
summary: A centered SaaS hero with a glowing backdrop and one call to action.
description: |
  A centered headline, a short lead and one filled button over a radial glow.
access: pro
---

# Hero: centered headline over a soft glow
EOF
echo '.glow { background: radial-gradient(circle, #3b2a6b, transparent); }' > hero-pro/glow.css

akb() { echo "\$ akb $*"; "$H/akb.sh" "$@" 2>&1; echo "[exit $?]"; }
{ echo '# throwaway PostgreSQL'; cat $Q/pg.out; echo; echo '# the maintainer (handle neverchanje) publishes two templates'
  AKB_HOME=$Q/maint akb cloud template publish hero-tilted-screen --preview extra/cover.png --evidence extra/linear.webp --evidence extra/capture.md
  AKB_HOME=$Q/maint akb cloud template publish hero-pro --preview extra/glow.png; } > "$P/00-setup.log"

akb cloud template list-tags --category ui > "$P/01-list-tags.log"
{ akb cloud template search --category ui --tags hero dark; akb cloud template search --category ui --tags pricing; } > "$P/02-search.log"
akb cloud template preview hero-tilted-screen --to assets/ > "$P/03-preview.log"
cp assets/hero-tilted-screen-cover.png "$P/03-preview.png"
{ akb cloud template get hero-tilted-screen --to site/; ls site
  diff -r site hero-tilted-screen >/dev/null && echo files-identical || echo files-differ; } > "$P/04-get.log"
mkdir site2; echo '# mine' > site2/template.md; cp site/hero.tsx /tmp/qa-cloud-tpl/hero.before
{ akb cloud template get hero-tilted-screen --to site/
  cmp -s site/hero.tsx /tmp/qa-cloud-tpl/hero.before && echo 'site/hero.tsx unchanged'
  akb cloud template get hero-tilted-screen --to site2/; echo '$ ls site2'; ls site2; cat site2/template.md; } > "$P/05-get-again.log"
{ akb cloud template source hero-tilted-screen; akb cloud template source hero-tilted-screen --to evidence/; } > "$P/06-source.log"
cp evidence/hero-tilted-screen-linear.webp "$P/06-evidence.webp"
{ akb cloud template get hero-centered-glow --to pro/; ls pro 2>&1; akb cloud template preview hero-centered-glow --to assets/; } > "$P/07-pro.log"
{ akb cloud sign-out; akb cloud template list-tags --category ui; } > "$P/08-signed-out.log"
node "$H/mint.mjs" $Q/home 11111111-1111-4111-8111-111111111111
akb cloud template publish hero-pro --preview extra/glow.png --replace > "$P/09-publish.log"

kill $(cat $Q/server.pid); pg_ctl -D $Q/pg/data -m fast stop >/dev/null
{ echo; echo '# the Worker log for the whole run'; grep -v '^rpc ' $Q/server.log; } >> "$P/00-setup.log"
