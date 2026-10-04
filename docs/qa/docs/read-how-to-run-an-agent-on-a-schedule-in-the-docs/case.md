# 在文档里查怎么让一个 Agent 定期运行

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **读者**：想让某件重复的事（每晚检查、每周清理）自己跑起来、还没在看板里找到入口的人。

## Steps

1. 打开文档的「The agents that work your board」页。
   开头一段说每个 Agent 有自己的页面，能设规则、运行的工具，周期 Agent 还能设多久跑一次；**Configuration → Workflows** 列每个工作流的 Agent，**Configuration → Board** 列看板为所有工作流跑的。右侧目录倒数第三项是「Run an agent on a schedule」。
   ![Agents 页与右侧目录](01-agents-page.png)

2. 点目录里的「Run an agent on a schedule」。
   页面滚到这一节，目录里该项高亮。开头一句：周期 Agent 不挂在卡片上自己跑，看板自己的在 **Configuration → Board**，工作流的在 **Configuration → Workflows** 的 **Scheduled** 下；「Coding ships one, the QA manager.」。下面四条：**Choose how often**（**Auto**、预设或自定义，**Disable** 关掉）、**Run now**（随时跑一次，停用时也行）、改动在开着 **Automatic Git commits** 时像构建一样提交、失败的一遍稍后重试或在 **Runs** 里 **Resume**。最后一行给命令：`akb workflow schedule <id> --on <agent> --cadence 1d`（或 `auto`）、`--off <agent>`、`--run <agent>`。
   ![Run an agent on a schedule 一节](02-run-an-agent-on-a-schedule.png)

3. 点目录里的「Add one of your own」。
   两条路：让编程 Agent 读 `akb guide write-agent` 后新建；或在 **Configuration → Workflows** 点 **Helpers** 旁或 **Scheduled** 下的 **+**。一句区分 helper（参与规划）和 scheduled（自己跑）；末尾一句 **Delete** 删掉自己加的 Agent 及其规则和记忆。
   ![Add one of your own 一节](03-add-one-of-your-own.png)

## Feedback

- **一屏讲完**：在哪设、怎么关、怎么手动跑、失败怎么办、命令是什么，四条加一行命令；和界面上的词（Scheduled、Auto、Disable、Run now、Resume）对得上。
- **Auto 讲得太虚**：「runs when there is something new for it」没说什么算新东西、没有新东西时会不会一直不跑；要靠信任。
- **「Run now … even while it is disabled」仍待核实**：#1414 实测停用的 Agent 点 **Run now** 被拒绝（见 [`local-ui/set-a-workflow-agent-to-run-on-a-schedule`](../../local-ui/set-a-workflow-agent-to-run-on-a-schedule/case.md)），这次只读文档没有重跑。
- **lead 和 Delete 回到了正确的位置**：以前落在本节末尾、读起来像在说周期 Agent；现在「Add one of your own」单独一节，不再混淆。
- **QA manager 的节奏不再打架**：旧版一处写每天、一处写卡片完成后，现在本节只说「Coding ships one」，跑多勤交给 **Auto**。
- **没说花多少**：每一遍是真实的 agent 运行，页上没有一句提成本。
- **没有跑到的**：窄屏、站内搜索；`akb guide write-agent` 本身。
