# 在文档里查怎么在对话里讨论想法、改卡片

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/daily-loop`，窗口 1280×1000。
- **命令**：一个刚 `akb install` 的空项目，建好一张卡（#2），另加一个运行时「Second Claude」，用来对照第 2、6 步；`claude` 用替身 Agent 顶替（以 `ping` 结尾的消息答 `pong`），不花钱。
- **读者**：想知道什么时候开对话、对话能改卡片到什么程度、怎么给对话换模型的人。

## Steps

1. 点左栏「Using the board」下的「Chat」。
   进入 `/docs/chat`，从页顶开始；分组「Using the board」，标题「Discuss ideas and update cards」，导语「Think through the work with an agent, then turn the decisions into cards and changes.」；开头一段分清 **New idea**（整个看板）和 **Discuss**（某张卡片），下面三条 `akb chat` 示例；右侧目录两节：Turn discussion into changes、A model per conversation。
   ![Chat 页顶部](01-chat-top.png)

2. 在空项目里照抄第一条示例 `akb chat "what should I build next, and why?"`，再试一条卡片的示例。
   第一条开始一段看板级讨论。**实测失败**：报 `command-argument value 'what should I build next, and why?' is invalid for argument 'id'. takes a card id`，加 `--new` 也一样——不带卡号就没法从终端开讨论；已提 triage。带卡号的 `akb chat 2 "…"` 正常回答。
   [三条示例的输出](02-chat-examples.log)

3. 点右侧目录里的「Turn discussion into changes」。
   滚到这一节：多数时候在对话里改草稿，说要改什么、卡片就更新；也能提问、回答待澄清问题、开始构建；只想聊就说先别动。下一段：正在运行的卡片不能在对话里改，`--clear` 重新开一段对话。
   ![把讨论变成改动](03-turn-into-changes.png)

4. 点这一节里的「revise a draft」。
   `/docs/drafts#request-changes` 在新标签页打开；Chat 页留在原标签页。
   [标签页前后](04-draft-link.log)

5. 关掉新标签页，点右侧目录里的「A model per conversation」。
   滚到这一节：在 **Send** 旁或终端里用 `--runtime <id>` 选运行时（编码 Agent 加模型）；`akb agent` 列出 id，`--runtime ""` 回到看板的；每段对话各自选；换到同一编码 Agent 的运行时保留对话，换到别的编码 Agent 重开一段。不再提 `--agent`、`--model`。
   ![每段对话一个模型](05-model-per-conversation.png)

6. 在空项目里照这一节跑：`akb agent` 看 id，再对 #2 用 `--runtime second_claude`、`--runtime nosuch`、`--runtime ""`，最后试旧的 `--agent`、`--model`。
   `akb agent` 每个运行时下有一行 `id`；`--runtime second_claude` 答「the conversation about #2 now runs "Second Claude".」再回答；不存在的 id 报错并列出可用的 `global, second_claude`；`--runtime ""` 回到「Global default」；`--agent`、`--model` 报 `unknown option`，与页面不再提它们一致。
   [运行时选项的输出](06-chat-runtime.log)

7. 点这一节里的「Runs」。
   `/docs/runs#which-runtime-each-agent-runs-on` 在新标签页打开；Chat 页留在原标签页。
   [标签页前后](07-runs-link.log)

## Feedback

- **终端选项改对了**：照页面敲 `--runtime` 一次就成，`akb agent` 里确实能找到 id，填错 id 时报错还列出可选的，比之前照文档就报 `unknown option` 好很多。
- **第一条示例跑不通**：页顶最显眼的 `akb chat "what should I build next, and why?"` 直接报「takes a card id」，新读者第一下就碰壁，又没有别的写法能从终端开讨论。
- **「runtime」要先懂**：这一节靠「runtime — a coding agent and its model」一句解释，没读过 Runs 页的人得跳过去才明白要先建一个运行时。
- **`--runtime <id>` 被拆行**：1280 宽下行内代码在「--」后断开，看起来像两段。
- **「保留对话」没法在这里验证**：替身 Agent 不记上下文，同一编码 Agent 换运行时后是否真的接着聊，只看到了「now runs …」的提示。
- **没有跑到的**：在看板界面里真的开对话、在 Send 旁换运行时（见 local-ui 模块的场景）；窄屏。
