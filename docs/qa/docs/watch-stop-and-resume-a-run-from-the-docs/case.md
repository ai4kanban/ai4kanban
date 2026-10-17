# 在文档里查怎么看、停、续跑一次运行，以及给 Agent 换运行时

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/triage`，窗口 1280×1000。
- **命令**：一个刚 `akb install` 的临时项目，用来对照第 3、6 步；`claude` 用替身 Agent 顶替，`akb agent test` 不花钱。
- **读者**：有运行在后台跑、想看进度或叫停它，或想让构建换一个模型的人。

## Steps

1. 点左栏「Using the board」下的「Runs and runtimes」。
   进入 `/docs/runs`，从页顶开始；分组「Using the board」，标题「Manage runs and runtimes」，导语「Follow background work in Runs. Each run has a log and can be stopped; each agent can use its own coding tool and model.」；左栏高亮移到「Runs and runtimes」；右侧目录三节：Watch or recover a run、Sub-runs、Which runtime each agent runs on。
   ![Runs 页顶部](01-runs-top.png)

2. 读「Watch or recover a run」。
   一句：打开 **Runs** 或问编码 Agent「what's running?」，应用和 `akb run` 看到的是同一批运行；一张两列表四行：看进度（日志、终端 `--follow`）、停（连带它起的命令一起结束、放开卡片）、续跑（**Resume**）、重来（**Retry**）；下面两段讲建卡中断时的 **Resume creating** / **Discard**，以及运行记录只在本机。
   ![看或恢复一次运行](02-watch-or-recover.png)

3. 在临时项目里看 `akb run --help` 和 `akb run log --help`，与第 2 步的表对照。
   有 `list`、`log`（带 `-f, --follow`）、`stop`、`resume`；没有 `retry`——**Retry** 只是应用里的按钮，页上没说这一点。`akb run list` 答「nothing is running, and nothing has lately」。
   [run 命令](03-run-commands.log)

4. 点右侧目录里的「Sub-runs」。
   地址栏带 `#sub-runs`；一段：Agent 用 `akb run start "<task>"` 分出子运行，**Runs** 里它排在起它的那一步下面，有自己的日志、花费和模型；改动随父运行一起落地，停父运行连子运行一起停。
   ![子运行](04-sub-runs.png)

5. 点目录里的「Which runtime each agent runs on」。
   地址栏带 `#which-runtime-each-agent-runs-on`；先说运行时包括什么、在 Agent 页的 Configuration → Workflows / Board 选，在 Configuration → Runtimes 管理，**Global default** 兜底；四行命令示例；**Test** 或 `akb agent test`；API key 自己填、别贴进对话；运行时和 key 只在本机。最后一段链到 Multi-runtime support 和 chat。
   ![每个 Agent 用哪个运行时](05-which-runtime.png)

6. 在临时项目里依次跑这一节的命令，再跑 `akb agent test my_gateway`。
   `runtime add` 给出 id `my_gateway`；`set` 记下 base URL；`bind builder my_gateway` 后 `akb agent` 里 builder 一行写着「My gateway」，其他 Agent 仍是「(Global default)」；`agent test` 答「it answered … The board can run it.」（替身 Agent 回答）。
   [照文档跑的命令](06-runtime-commands.log)

7. 点这一节最后一句的「chat」。
   `/docs/chat#a-model-per-conversation` 在新标签页打开；Runs 页留在原标签页。
   [标签页前后](07-chat-link.log)

## Feedback

- **一张表回答「我想…」**：按想做的事排，看、停、续、重来四行一眼扫完，比旧版「你说什么 → 发生什么」更像操作指南。
- **命令照抄就能跑**：四行运行时命令在新项目里一次跑通，`akb agent` 马上能看到 builder 换了运行时。
- **代码块被截断**：`akb agent set … https://my-gateway.example.com` 一行在 1280 宽下超出框，要横向滚动才看到完整地址。
- **Retry 没说在哪**：表里和 Resume 并列，但命令行没有 `retry`，读者在终端里会找不到；Resume 的「where supported」也没说哪里不支持。
- **页尾和 Chat 页说法不一**：这里说一段对话「can use a different agent or model」，Chat 页已改成选「runtime」，两页读下来像两套概念。
- **更新日期偏早**：页头写「Updated October 15, 2026」，这次改动在 10 月 18 日才落地。
- **没有跑到的**：在应用的 **Runs** 面板里真的看日志、停、续跑一次运行，以及子运行的展示（见 skill、local-ui 模块的场景）；窄屏。
