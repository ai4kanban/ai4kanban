#!/bin/zsh
# Builds the scratch project for this case: card #2 carries a blog post in English, Chinese
# and Japanese (`post.<lang>.md`, long, with a relative picture) and a short `.mdx` note.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>   (needs ffmpeg)
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm docs/kanban/setup-checklist.md
akb raw create --title "发布周报自动化的博客" --slug weekly-blog > /dev/null
A=$(node -e "import('$(dirname $CLI)/../dist/kanban.mjs').then(m=>console.log(m.assetsDir()))")
mkdir -p "$A/2"

ffmpeg -loglevel error -f lavfi -i "color=c=0x2a9d8f:s=1200x500" -frames:v 1 \
  -vf "drawbox=x=0:y=300:w=1200:h=80:c=0xe9c46a:t=fill" "$A/2/hours-saved.png"

body() { # $1 paragraph text
  for n in 1 2 3 4 5 6; do print "\n## $2 $n\n\n$1\n\n- $3 A\n- $3 B\n"; done
}
{
  print -- '---\ntitle: "每周报告，五分钟写完"\ndek: 把周报交给看板之后，我们每周省下的三个小时花在了哪里。\nseo_title: 周报自动化 | AI4Kanban\ntags: [周报, 自动化]\n---\n'
  print -- '周一早上，团队不再翻聊天记录拼周报。\n\n![每周省下的时间](hours-saved.png)\n\n```bash\nakb raw list --archived --since 7d\n```'
  body "看板把上周落地的卡片按模块列出，负责人只补一句结论。" "第" "要点"
  print -- '\n## 结尾\n\n这是全文最后一段：周报终于不再是负担。'
} > "$A/2/post.zh.md"
{
  print -- '---\ntitle: "Weekly reports in five minutes"\ndek: Where the three hours a week went after we handed reports to the board.\nseo_title: Weekly report automation | AI4Kanban\n---\n'
  print -- 'On Monday mornings nobody digs through chat to write the report any more.\n\n![Hours saved each week](hours-saved.png)'
  body "The board lists last week's landed cards by module; the owner adds one line." "Part" "Point"
  print -- '\n## The end\n\nThis is the last paragraph: the report is no longer a chore.'
} > "$A/2/post.en.md"
print -- '---\ntitle: 週報を5分で\ndek: 週報をボードに任せてから、毎週の3時間はどこへ行ったか。\n---\n\n月曜の朝、もうチャットを遡って週報を書く人はいない。' > "$A/2/post.ja.md"

cat > "$A/2/launch.mdx" <<'MDX'
---
title: 发布说明
dek: 上线当天要发的一段话。
---
import { Callout } from "../components/Callout";
export const meta = { draft: true };

上线后，周报会在每周一 9 点自动生成。

<Callout type="warn">
这一整块是组件，卡片页上不该看到。
</Callout>

行内组件：<Badge>新功能</Badge>只去掉标签。
MDX

awk 'f < 2 { print } /^---$/ { f++ }' docs/kanban/todo/2-weekly-blog.md > card.new
cat >> card.new <<'CARD'

写一篇介绍周报自动化的博客，中英日三语。

<Asset src=".assets/2/post.zh.md" label="博客原稿" />

<Asset src=".assets/2/launch.mdx" label="发布说明" />

<!-- agent -->

## Scope

- **博客**：三语原稿。

## Todo

- [ ] 写博客

## Decided by the agent

### Overruled by the user
CARD
mv card.new docs/kanban/todo/2-weekly-blog.md
git add -A && git commit -qm init
