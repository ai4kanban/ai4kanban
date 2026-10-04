# 在文档里查怎么让一个 Agent 定期运行

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/agents`，窗口宽 1280px。
- **读者**：想让某件重复的事（每晚检查、每周清理）自己跑起来、还没在看板里找到入口的人。

## Steps

1. 打开文档的「The agents that work your board」页。
   开头一段讲 Configuration → Workflows 时多了半句：两个阶段下面是这个工作流按周期运行的 Agent（「and under them the agents it runs on a schedule」）。右侧「On this page」目录的最后一项是「Run an agent on a schedule」。
   ![Agents 页与右侧目录](01-agents-page.png)

2. 点目录里的「Run an agent on a schedule」。
   页面滚到这一节，目录里该项高亮。开头说工作流可以带自己运行的 Agent，在 Configuration → Workflows 的 **Scheduled** 下、只属于这个工作流；「Coding ships one, running when cards finish: the QA manager.」，「QA manager」链到 Daily loop 页的「Test cases」。第二段：周期任务卡搬到了这里（「Recurring cards have moved here」）。下面粗体开头的要点：在 Agent 页上设（**Auto** 是默认、**Disable** 是同一个列表的最后一项、**Run now** 在停用时也能用）；**Auto runs it when there is new work**——`akb.reads` 可等的新东西只有 `archived-cards`、`chats`、`dismissals` 三种，不再有 `commits`，没设的一天一次；等你和构建；开启的那一刻不运行；改动像构建那样提交。
   ![Run an agent on a schedule 一节](02-run-an-agent-on-a-schedule.png)

3. 往下滚到这一节的末尾。
   其余要点：没人回答它；失败的一遍等一个周期再试、连续失败加倍等待，或在 **Runs** 里 **Resume**；运行里用 `akb raw list --archived --since last-run` 问上次以来落地了什么。之后「From a terminal:」给出 `akb workflow schedule <id> --on <agent> --cadence 1d`（或 `auto`）、`--off <agent>`、`--run <agent>` 和 `akb workflow list`。再往下两段——能当 **lead** 的 Agent、Agent 页上的 **Delete**——然后这一页结束。
   ![这一节的后半](03-rest-of-the-section.png)

## Feedback

- **照着能做完**：从哪里进、点什么、什么时候第一次跑、改动去哪，一节里都有；和界面上的词（Scheduled、Auto、Disable、Run now）对得上，命令也是真的那几条。
- **触发不再靠 git**：`akb.reads` 只剩卡片归档、对话、忽略三种，不用 git 或不在主分支上的项目也会照常跑；但页上没有一句说 `commits` 去哪了，写过它的人要自己猜（实际被当作 `archived-cards`）。
- **「works while the agent is disabled」仍待核实**：#1414 实测停用的 Agent 点 **Run now** 不运行（见 [`local-ui/set-a-workflow-agent-to-run-on-a-schedule`](../../local-ui/set-a-workflow-agent-to-run-on-a-schedule/case.md)），这次只读文档没有重跑。
- **QA manager 的节奏前后不一**：本节说「running when cards finish」，同页自带清单写「once a day」，读的人分不清它按什么跑。
- **最后两段放错了节**：讲 **lead** 和 **Delete** 的两段落在「Run an agent on a schedule」下面，读到「It can be written to lead a plan or execute stage instead」的人会以为在说周期 Agent。
- **手动提交的后果只说了一半**：「With it off, the changes stay uncommitted」没说这些文件不提交时下一遍会怎样。
- **怎么新建一个没在这一节说**：要回到「Add one of your own」才知道点 **Scheduled** 下的「+」或写 `akb.hook: schedule`。
- **没有跑到的**：窄屏、站内搜索；`akb guide write-agent` 里同样去掉 `commits` 的说明，这次没有为它截证据。
