#!/bin/zsh
# Builds the scratch project for this case: card #2 carries a desktop mockup in two language
# versions, a Markdown write-up, an image without a label, and an image <Compare>.
# Usage: seed.sh <project dir> <path to cli/bin/ai4kanban.mjs>   (needs ffmpeg)
set -e
P=$1 CLI=$2
akb() { env -u CLAUDE_CODE_SESSION_ID -u KANBAN_RUN node "$CLI" "$@" }
mkdir -p "$P" && cd "$P"
git init -q && git config user.name qa && git config user.email qa@example.com
akb install > /dev/null
rm -f docs/kanban/setup-checklist.md
akb raw create --title "首页改版" --slug home-redesign > /dev/null
A=.akb/boards/docs/kanban/assets/2 && mkdir -p $A

for lang in zh en; do
  [[ $lang == zh ]] && T="欢迎回来" S="今天有 3 个待办" || T="Welcome back" S="3 to-dos today"
  cat > $A/home-$lang.tsx <<TSX
export default function Home() {
  return (
    <div className="min-h-screen bg-stone-50 p-10 font-sans text-stone-800">
      <h1 className="text-3xl font-bold">$T</h1>
      <p className="mt-2 text-stone-500">$S</p>
      <div className="mt-8 grid grid-cols-3 gap-4">
        {[1, 2, 3].map((n) => <div key={n} className="h-32 rounded bg-white shadow" />)}
      </div>
    </div>
  );
}
TSX
done

cat > $A/competitors.md <<'MD'
# 对比 TASKMASTER

TASKMASTER 把待办放在左栏，我们放在首页正中。

- **入口**：它要点两下，我们一下。
- **空状态**：它显示插画，我们直接给出第一条建议。

| 项目 | TASKMASTER | 我们 |
| --- | --- | --- |
| 首屏待办 | 5 条 | 3 条 |
| 加载 | 1.2 秒 | 0.8 秒 |
MD

ff() { ffmpeg -loglevel error -y "$@" }
ff -f lavfi -i "color=c=0x2a9d8f:s=1600x900" -frames:v 1 -vf "drawbox=x=0:y=400:w=1600:h=100:c=black:t=fill" $A/traffic.png
ff -f lavfi -i "testsrc=s=960x540:d=1" -frames:v 1 $A/old.png
ff -i $A/old.png -vf "hue=h=120" $A/new.png

awk 'f < 2 { print } /^---$/ { f++ }' docs/kanban/todo/2-home-redesign.md > card.new
cat >> card.new <<'CARD'

首页改成三张待办卡片。

<Asset src=".assets/2/home-zh.tsx" label="首页（桌面）" device="desktop" variants='{"中文": ".assets/2/home-zh.tsx", "English": ".assets/2/home-en.tsx"}' />

<Asset src=".assets/2/competitors.md" label="对比 TASKMASTER" />

<Asset src=".assets/2/traffic.png" />

<Compare a=".assets/2/old.png" b=".assets/2/new.png" label="改版前后" a-label="改版前" b-label="改版后" />

<!-- agent -->

## Scope

- **首页**：三张待办卡片。

## Todo

- [ ] 改首页

## Decided by the agent

### Overruled by the user
CARD
mv card.new docs/kanban/todo/2-home-redesign.md
git add -A && git commit -qm init
