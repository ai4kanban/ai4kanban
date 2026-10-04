# 在文档里查 QA 手册是怎么维护的

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **读者**：发现项目里多了 `docs/qa/`、或在「配置 → 工作流」里看到「QA manager」，想知道它什么时候跑、改什么、怎么关的人。

## Steps

1. 在「The agents that work your board」页往下滚到自带 Agent 清单的末尾。
   清单之后单独一句「One more runs on a schedule instead of during planning:」，下面一条 **`qa-manager`** (QA manager)：每天一遍，更新上次运行以来完成的卡片影响的、项目里 `docs/qa/` 下的用例，再为一个还没补写的模块写出第一批；「test cases」是链接。
   ![自带 Agent 清单里的 qa-manager](01-shipped-agents.png)

2. 点「test cases」。
   链接在新标签页打开（原页不动），地址是 `/docs/daily-loop#test-cases`；页面停在「Test cases」一节，右侧目录里该项高亮。开头说卡片完成后 QA manager（Coding 的定期运行 Agent）更新用例。下面七条：**Where they are**、**Read them on the board**（看板左栏底部的 **Test cases**，手机上在 **More** 里；反馈旁的 **Send to Triage** 把它变成一个注明用例的待筛选条目）、**The index**、**What a run does**（跨两个以上模块时分给子运行并行）、**How it lands**、**A case that fails**、**Turn it off**。
   ![Test cases 一节](02-test-cases.png)

3. 在同一页往上滚到「Build a card」一节的要点。
   「Manual commit mode」「A workflow that makes files gets no branch」之后直接是「No AI review」：构建完成后直接落地，只有你自己的检查和未答问题会拦住它。整页没有「Hooks run after the build」，也没有「After executing」。
   ![Build a card 的要点](03-build-a-card.png)

## Feedback

- **一节讲全了**：在哪、怎么在看板上读、什么时候跑、改什么、怎么落地、失败去哪、怎么关，七条各一句，和界面上的词（Test cases、Send to Triage、Scheduled、Disable）对得上。
- **Send to Triage 一句就够**：读的人知道反馈不是只能看，能直接变成待办的线索；但没说它进 Triage 之后会不会被自动分拣成卡。
- **构建后不再有钩子，但文档没说去哪了**：「Build a card」里那条直接消失，升级的人只能在 Agents 页「Add one of your own」读到「Nothing runs after a build」；这一页本身没有一句提示。
- **「Once a day」和「Once cards finish」打架**：Agents 页清单写每天一遍，这一节开头却说卡片完成后才跑；读的人分不清它到底按什么跑、要花多少次运行。
- **链接开新标签页**：清单里的「test cases」带 `target="_blank"`，点一下多一个标签页，原页不动；站内跳转不该这样。
- **花多少没说**：每一遍是真实的 agent 运行，补写模块那一遍还会把场景真的走一遍；这一节没有一句提成本。
- **没有跑到的**：中文等其他语言的文档页、窄屏；看板里 **Send to Triage** 按钮本身属于 local-ui，这里只读了文档。
