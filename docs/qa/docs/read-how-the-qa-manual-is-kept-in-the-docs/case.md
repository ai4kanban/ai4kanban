# 在文档里查 QA 手册是怎么维护的

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **读者**：发现项目里多了 `docs/qa/`、或在「配置 → 工作流」里看到「QA manager」，想知道它什么时候跑、改什么、怎么关的人。

## Steps

1. 点右侧目录里的「Run an agent on a schedule」。
   这一节第一段末尾：「Coding includes QA manager.」，「QA manager」是链接。Roles 和 Specialists 里都没有它。
   ![Run an agent on a schedule 里的 QA manager](01-run-on-a-schedule.png)

2. 点「QA manager」。
   链接在新标签页打开 `/docs/daily-loop#test-cases`，原页不动。
   [标签页前后](02-qa-manager-link.log)

3. 看新标签页。
   页面停在「Test cases」一节，右侧目录里该项高亮。开头一句：卡片完成后，Coding 的周期 Agent **QA manager** 写和更新用例，每步用截图、GIF 或日志证明。下面五条：**Where they are**（`docs/qa/<module>/<case>/case.md`，索引在 `docs/qa/README.md`，证据留在本机 `.akb/qa/`、不进 git）、**Read them on the board**（左栏底部的 **Test cases**，手机上在 **More** 里；**Send to Triage** 把反馈变成待筛选条目）、**What a run does**（更新最近完成的卡片影响的用例，再补写一个模块）、**A case that fails**（进 Triage，注明用例和步骤）、**How often**（在 **Configuration → Workflows → Coding** 的 **Scheduled** 下设，或 **Disable**，并链回「Run an agent on a schedule」）。
   ![Test cases 一节](03-test-cases.png)

4. 点目录里的「Build a card」。
   要点里「Workflows that make files」之后是「No AI review」：你自己的检查决定能否落地，**Suggest follow-up work** 补构建漏掉的。整页没有「Hooks run after the build」。
   ![Build a card 的要点](04-build-a-card.png)

> **证据环境**：main（01ddb6ac）上本地站点所有 `/docs` 页都是 500（见 [`read-the-agents-the-board-ships-in-the-docs`](../read-the-agents-the-board-ships-in-the-docs/case.md)，已报待筛选）。以上截图取自 `web/` 的临时副本，只把 `public/llms.txt` 里 Agents 那一行换成新描述。

## Feedback

- **五条讲清**：在哪、怎么在看板上读、一遍做什么、失败去哪、怎么设频率，各一句，和界面上的词（Test cases、Send to Triage、Scheduled、Disable）对得上；证据不进 git 也写明了。
- **入口更不显眼了**：Agents 页只剩半句「Coding includes QA manager」，没说它做什么；不点链接的人不会知道 `docs/qa/` 是它写的。
- **两页互相链**：Test cases 的 How often 链回 Agents 页的周期一节，来回跳不迷路。
- **链接仍开新标签页**：站内跳转多出一个标签页。
- **花多少没说**：每一遍是真实的 agent 运行，补写模块那一遍还会把场景真的走一遍；这一节没有一句提成本。
- **没有跑到的**：其他语言的文档页、窄屏；看板里 **Send to Triage** 按钮本身属于 local-ui，这里只读了文档。
