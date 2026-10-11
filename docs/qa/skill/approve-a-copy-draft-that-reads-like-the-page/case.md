# 在卡片上读文案草稿，像读页面本身一样

## Setup

- **项目**：一次性 git 项目，只有 `app/page.tsx`：`metadata` 里有标题和描述，正文是一封用 `<p className=…>`、`&apos;`、`&mdash;` 写成、像功能清单的欢迎信；`akb install` 新装，删掉 `setup-checklist.md` 和自带的 #1 后提交。
- **Agent**：真实的 Claude Code（`claude-opus-5-5`），看板默认的 Coding 工作流。
- **终端**：zsh，在项目目录里；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb create "Rewrite the welcome letter on the home page (app/page.tsx) so it reads like one freelancer writing to another, not a feature list. Update the page title and description to match."`。
   立即返回一次 `create` 运行；结束后新卡 #2 问欢迎信由谁署名。
   [01-create.log](01-create.log)

2. 执行 `akb card resolve 2 "Option 3: sign it — a fellow freelancer"`。
   返回一次 `resolve` 运行；结束后卡片标为 `ready`，没有请文案 Agent。
   [02-resolve.log](02-resolve.log)

3. 执行 `akb card revise 2 "Before anyone edits the page, draft the new letter, title and description for me to approve."`。
   返回一次 `edit` 运行。
   [03-revise.log](03-revise.log)

4. 运行结束后执行 `akb run list`。
   `edit #2` 之后自动跑了 `spec copywriting #2`（39 秒，约 $0.26），已没有在跑的运行。
   [04-runs.log](04-runs.log)

5. 打开卡片 #2。
   `## By \`copywriting\` agent` 里的欢迎信是可以直接读的纯文本：没有 diff、标签、`className` 或转义字符，开头一行写明问候语不变，署名 `— a fellow freelancer`；标题和描述单列为 `Title: …`、`Description: …`；最后两条 Notes；唯一的问题请你批准或退回这份文案。
   [05-card.log](05-card.log)

## Feedback

- **终于读得出语气**：整封信像寄来的信一样摆在卡上，判断「像不像同行写的」只需读一遍，不用在 TSX 碎行里拼句子。
- **Notes 有用**：它点出「Neither did I」默认写信人是自由职业者——如果不是就得删，这正是批准前该知道的事。
- **要自己开口才有草稿**：第一次回答问题后，规划直接把卡标成 `ready`，措辞留给构建去写；只有加一句「先给我看文案」才会请文案 Agent。
- **没有跑到的**：零星改几个词时的 ~~旧句~~ → 新句 写法；新页面；中英文两种语言的页面；批准后构建把文案写回 `page.tsx`。
