# 看板自带的 Agent 在「自动」下多久跑一次

## Setup

- **看板**：一个刚用 `akb install` 建好的看板（项目是 git 仓库），删掉 `docs/kanban/setup-checklist.md`，界面语言为中文；所有定期 Agent 保持默认的「自动」，还没有对话、拒绝记录或完成的卡片。
- **界面**：这次构建的 `kanban-ui`（`AI4KANBAN_CLI` 指向这次构建出的 `cli/dist/kanban.mjs`），在浏览器里打开看板，窗口 1280×1000。截图只截「配置」窗口。
- **英文界面（第 6–9 步）**：把界面语言换成 English 后重开同一个看板。

## Steps

1. 点右上角的「配置」，再点左栏的「看板」；点「定期运行」下的「回顾对话」，再点名称旁的「自动」。
   菜单第一行灰字「有新对话后运行」；「自动」打勾，下面浅色小字「有新对话后，最多每 6 小时一次」；然后「每 6 小时」「每天」「每 7 天」「自定义」，最后是「停用」。
   ![回顾对话的周期菜单](01-review-chats.png)

2. 按 Esc，点「回顾拒绝和忽略记录」，再点「自动」。
   第一行「有新的拒绝或忽略原因后运行」；「自动」下面「有新的拒绝理由后，最多每 6 小时一次」。
   ![回顾拒绝和忽略记录的周期菜单](02-learn-from-rejections.png)

3. 按 Esc，点「描述项目」，再点「自动」。
   第一行「下次运行 6 小时后」；「自动」下面「有卡片完成后，最多每 6 小时一次」。
   ![描述项目的周期菜单](03-describe-the-project.png)

4. 按 Esc，点「整理记忆」，再点「自动」。
   第一行「下次运行 7 天后」；「自动」下面「每 7 天一次」——它不等任何输入。
   ![整理记忆的周期菜单](04-tidy-memory.png)

5. 按 Esc，点「建议后续任务」。
   它没有周期小控件；描述下面「触发时机 有新完成的卡片时，最多每 6 小时一次。」
   ![建议后续任务的触发时机](05-suggest-follow-ups.png)

6. 用英文界面打开「Configuration → Board」，点「Review chats」，再点「Auto」。
   第一行「Runs after new chats」；「Auto」下面「After new chats, at most every 6h」；选项「Every 6 hours」「Every day」「Every 7 days」「Custom」「Disable」。
   ![英文：Review chats](06-english-review-chats.png)

7. 点「Learn from rejections and dismissals」，再点「Auto」。
   第一行「Runs after new rejection or dismissal reasons」；「Auto」下面「After new rejection reasons, at most every 6h」。
   ![英文：Learn from rejections and dismissals](07-english-rejections.png)

8. 点「Describe the project」，再点「Auto」。
   第一行「Next run in 6h」；「Auto」下面「After a card is finished, at most every 6h」。
   ![英文：Describe the project](08-english-describe.png)

9. 点「Tidy memory」，再点「Auto」。
   第一行「Next run in 7d」；「Auto」下面「Once every 7d」。
   ![英文：Tidy memory](09-english-tidy-memory.png)

## Feedback

- **一眼知道「自动」是什么**：每个 Agent 的「自动」都说出了它等什么、最多多久一次，和「工作流」里的定期 Agent 是同一个菜单、同一种说法。
- **同一件事说两遍**：回顾对话的菜单里，第一行「有新对话后运行」，下面一行「有新对话后，最多每 6 小时一次」，几乎重复；左栏的副标题也是同一句。
- **拒绝和忽略对不上**：这个 Agent 叫「回顾拒绝和忽略记录」，第一行也说「拒绝或忽略原因」，「自动」的说明却只说「新的拒绝理由」；英文同样少了 dismissal。只忽略了条目的人会以为它不管。
- **「下次运行 6 小时后」不一定发生**：描述项目还要等有卡片完成，没卡片完成时这一行和下面的说明互相矛盾。
- **整理记忆的「自动」就是「每 7 天」**：两个选项效果一样，看不出为什么要分开。
- **英文缩写夹在整句里**：「at most every 6h」「Once every 7d」「Next run in 7d」，紧挨着「Every 7 days」，读起来像两套写法。
- **左栏副标题不统一**：有的写「自动」，有的写「有新对话后运行」，同一列两种意思。
- **没有跑到的**：真有新对话、拒绝记录或完成的卡片后，6 小时间隔是否生效（要真的起 Agent 并等 6 小时）；建议后续任务的实际运行。
