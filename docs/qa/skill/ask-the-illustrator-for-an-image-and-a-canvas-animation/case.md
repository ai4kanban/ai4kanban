# 请产品配图先画一张示意图，再做一段 canvas 动画预览

## Setup

- **项目**：一次性 git 项目，有 `README.md` 和 `app/page.tsx`（`Tally` 标题加一封欢迎信）；`akb install` 新装，删掉 `setup-checklist.md` 和自带的 #1 后提交。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流。
- **渲染**：截图是用 esbuild 加 `react-dom/server` 把 `.tsx` 渲染成静态页、再由无头 Chrome 拍下的，没有经过看板的画框和 Tailwind，所以版式与卡片页上不同。
- **终端**：zsh，在项目目录里；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb create "Add an illustration under the welcome letter on the home page that shows how Tally works in three steps: create an invoice, send it, get paid."`。
   立即返回一次 `create` 运行；结束后新卡 #3 问要手绘插图还是图标加文字。
   [01-create-illustration.log](01-create-illustration.log)

2. 执行 `akb card resolve 3 "Option 1: drawn artwork"`。
   返回一次 `resolve` 运行；结束后卡片仍没有配图段，画图留给了构建。
   [02-resolve.log](02-resolve.log)

3. 执行 `akb card revise 3 "Draw the illustration on this card for me to approve before anyone edits the page."`。
   返回一次 `edit` 运行。
   [03-revise.log](03-revise.log)

4. 运行结束后（2 分 37 秒）打开卡片 #3 和它的配图。
   `## By \`illustrator\` agent` 里是一行 `<Asset src=".assets/3/illus-how-it-works.tsx" label="How it works" alt="How Tally works: create an invoice, send it, get paid." />`：`label` 只有三个词，整句图注在 `alt` 里；图本身底部也用斜体画着这句图注。
   [04-card.log](04-card.log) · [04-illustration.png](04-illustration.png)

5. 执行 `akb create "Put a slowly drifting field of small dots, drawn on a canvas, behind the Tally heading on the home page. Show me a running preview of the animation on this card to approve before anyone edits the page."`。
   立即返回一次 `create` 运行。
   [05-create-animation.log](05-create-animation.log)

6. 等运行结束后执行 `akb run list`。
   `create` 之后自动跑了 `clarify #4` 和 `spec illustrator #4`（57 秒，约 $0.40），已没有在跑的运行。
   [06-runs.log](06-runs.log)

7. 打开卡片 #4 和它的样稿文件。
   配图段只有一个 `.tsx`（`illus-dot-field.tsx`，不是 `.html`），`label="Dot field preview"`；文件里一个 `<canvas>` 加一段 `<script dangerouslySetInnerHTML>`，没有外链、没有 import；唯一的问题请你批准或退回这段预览。
   [07-card.log](07-card.log)

8. 把样稿渲染成页面，分别在约 1 秒和 6 秒时截图。
   两张截图不同：内联脚本在跑，标题后方的灰点在缓慢移动。
   [08-preview-1s.png](08-preview-1s.png) · [08-preview-6s.png](08-preview-6s.png)

## Feedback

- **标签终于不挤了**：`label` 只有几个词，图注进了 `alt`，图上也印着同一句，读者不打开源码也知道图在说什么。
- **一种格式就够**：要动起来的预览也是 `.tsx`，画框、文件位置和静态图一样，不用记什么时候该写 `.html`；静态图里没有多余的脚本。
- **要自己开口才有图**：手绘插图那张，回答问题后规划没有请产品配图，直到用 `revise` 说「先在卡上画给我看」；动画那张因为一开始就要了预览，才自动请了它。
- **动画没有说明 alt**：装饰性动画不加 `alt` 是对的，但卡上只看得到 `Dot field preview`，看不出它会不会在「减少动态效果」时停下——这条写在 Decided by the agent 里。
- **没有跑到的**：在看板卡片页上看样稿实际播放（属于 local-ui）；批准后构建把样稿搬进 `app/`；封面图不画图注的博客配图。
