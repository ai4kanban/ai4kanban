# 在文档里查怎么在对话里讨论想法、改卡片

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/daily-loop`，窗口 1280×1000。
- **命令**：一个刚 `akb install` 的空项目，用来对照第 5 步。
- **读者**：想知道什么时候开对话、对话能改卡片到什么程度、怎么给对话换模型的人。

## Steps

1. 点左栏「Using the board」下的「Chat」。
   进入 `/docs/chat`，从页顶开始；分组「Using the board」，标题「Discuss ideas and update cards」，导语「Think through the work with an agent, then turn the decisions into cards and changes.」；开头一段分清 **New idea**（整个看板）和 **Discuss**（某张卡片），下面三条 `akb chat` 示例；右侧目录两节：Turn discussion into changes、A model per conversation。
   ![Chat 页顶部](01-chat-top.png)

2. 点右侧目录里的「Turn discussion into changes」。
   滚到这一节：多数时候在对话里改草稿，说要改什么、卡片就更新；也能提问、回答待澄清问题、开始构建；只想聊就说先别动。下一段：正在运行的卡片不能在对话里改，`--clear` 重新开一段对话。
   ![把讨论变成改动](02-turn-into-changes.png)

3. 点这一节里的「revise a draft」。
   `/docs/drafts#request-changes` 在新标签页打开，停在「Request changes」；Chat 页留在原标签页。
   [标签页前后](03-draft-link.log)

4. 关掉新标签页，点右侧目录里的「A model per conversation」。
   滚到这一节：在 **Send** 旁边选编码 Agent 和模型，终端里用 `--agent` 和 `--model`；每段对话各自选；换模型保留对话，换 Agent 重开一段。
   ![每段对话一个模型](04-model-per-conversation.png)

5. 在空项目里照这一节跑 `akb chat --agent x` 和 `akb chat --model x`。
   两个选项都被接受。**实测失败**：两条都报 `unknown option`，`akb chat --help` 里只有 `--runtime`；已提 triage（docs-chat-agent-model-flags）。
   [三个选项的输出](05-chat-flags.log)

6. 点这一节里的「Runs」。
   `/docs/runs#which-runtime-each-agent-runs-on` 在新标签页打开，停在「Which runtime each agent runs on」；Chat 页留在原标签页。
   [标签页前后](06-runs-link.log)

## Feedback

- **一屏读完**：标题直接说能做什么，两节加起来不到十行，比旧版那张六行的表好扫。
- **终端选项写错了**：照页面敲 `--agent`、`--model` 直接报错，读者只能去翻 `--help` 才知道叫 `--runtime`；照文档操作第一次就失败，信任损失很大。
- **「Discuss」和「New idea」只有名字**：没截图、没说在界面哪里，第一次用的人要自己找按钮。
- **“改草稿”指向别页**：最常用的事只有一句加链接，要看具体怎么提修改得跳去 Draft review。
- **翻页标签和标题对不上**：左栏、翻页都叫「Chat」，进来标题是「Discuss ideas and update cards」，不影响找，但第一眼要确认一下。
- **没有跑到的**：在看板界面里真的开对话、换模型（见 local-ui 模块的场景）；窄屏。
