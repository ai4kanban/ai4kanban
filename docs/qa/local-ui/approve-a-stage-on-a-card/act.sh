#!/bin/zsh
# Run by the stand-in `claude` with the run's prompt on stdin. On the run #2's Approve starts
# (the one that makes its next stage) it takes a few seconds, then writes the article, shows it
# on the card and ticks the todo with its path.
P=/tmp/lui/proj4
grep -q 'Task 2 #2 .* has moved to its next stage' || exit 0
sleep 8
A=$P/.akb/boards/docs/kanban/assets/2
printf '# 把想法交给看板\n\n想法写成卡片，Agent 规划，做完归档。\n' > $A/article.md
F=$(ls $P/docs/kanban/todo/2-*.md)
perl -0pi -e 's/(<Asset src="\.assets\/2\/outline\.md"[^\n]*\n)/$1\n<Asset src=".assets\/2\/article.md" label="文章" \/>\n/; s/- \[ \] 交付文章/- [x] 交付文章：`.assets\/2\/article.md`/' $F
