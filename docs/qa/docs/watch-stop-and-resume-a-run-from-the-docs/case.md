# 在文档里查怎么看、停、续跑一次运行，以及给 Agent 换运行时

## Setup

- **站点**：官网（`web/`）在本地跑起来，浏览器打开 `/docs/triage`，窗口 1280×1000。
- **命令**：一个刚 `akb install` 的临时项目，用来对照第 5、8 步；`claude` 用替身 Agent 顶替，`akb agent test` 不花钱。
- **读者**：有运行在后台跑、想看进度或叫停它，或想让构建换一个模型的人。

## Steps

1. 点左栏「Using the board」下的「Runs and runtimes」。
   进入 `/docs/runs`，从页顶开始；分组「Using the board」，标题「Manage runs and runtimes」，导语「Follow background work in Runs. Each run has a log and can be stopped; each agent can use its own coding tool and model.」；左栏高亮移到「Runs and runtimes」；右侧目录三节：Watch or recover a run、Sub-runs、Which runtime each agent runs on。
   ![Runs 页顶部](01-runs-top.png)

2. 读「Watch or recover a run」。
   一句：打开 **Runs** 或问编码 Agent「what's running?」，应用和 `akb run` 看到的是同一批运行；接着一张图（见下一步）；再一张两列表四行：看进度（日志、终端 `--follow`）、停（连带它起的命令一起结束、放开卡片）、续跑（**Resume**）、重来（**Retry**）；下面两段讲建卡中断时的 **Resume creating** / **Discard**，以及运行记录只在本机。
   ![看或恢复一次运行](02-watch-or-recover.png)

3. 看第一句和表格之间的那张图。
   水彩底上一张像素办公室：六张工位坐着穿职业装的角色，头顶名牌是应用里的角色名和运行它的编码工具图标——三个 Builder、UI designer、Software planner、Copywriting，脚下是卡号（#374、#357…）；Builder 屏上是代码，UI designer 是设计稿，Software planner 和 Copywriting 是文档；右下沙发上歇着 Builder 和 Illustrator，两块名牌左右错开不重叠。左下两个页签「6 running」「Completed」，右上一个 ×。它一直在轻轻动；读屏器跳过它（`aria-hidden`）。
   ![运行动画](03-sessions-shot.png)

4. 滚到页底再滚回来；再把窗口换成 390px 宽的手机重新打开。
   离开视口时动画暂停，回来接着播；手机上缩到正文栏宽（342px）照常显示，页面没有横向滚动。
   [动画的暂停与播放](03-sessions-shot.log)

5. 在临时项目里看 `akb run --help` 和 `akb run log --help`，与第 2 步的表对照。
   有 `list`、`log`（带 `-f, --follow`）、`stop`、`resume`；没有 `retry`——**Retry** 只是应用里的按钮，页上没说这一点。`akb run list` 答「nothing is running, and nothing has lately」。
   [run 命令](03-run-commands.log)

6. 点右侧目录里的「Sub-runs」。
   地址栏带 `#sub-runs`；一段：Agent 用 `akb run start "<task>"` 分出子运行，**Runs** 里它排在起它的那一步下面，有自己的日志、花费和模型；改动随父运行一起落地，停父运行连子运行一起停。
   ![子运行](04-sub-runs.png)

7. 点目录里的「Which runtime each agent runs on」。
   地址栏带 `#which-runtime-each-agent-runs-on`；先说运行时包括什么、在 Agent 页的 Configuration → Workflows / Board 选，在 Configuration → Runtimes 管理，**Global default** 兜底；四行命令示例；**Test** 或 `akb agent test`；API key 自己填、别贴进对话；运行时和 key 只在本机。最后一段链到 Multi-runtime support 和 chat。
   ![每个 Agent 用哪个运行时](05-which-runtime.png)

8. 在临时项目里依次跑这一节的命令，再跑 `akb agent test my_gateway`。
   `runtime add` 给出 id `my_gateway`；`set` 记下 base URL；`bind builder my_gateway` 后 `akb agent` 里 builder 一行写着「My gateway」，其他 Agent 仍是「(Global default)」；`agent test` 答「it answered … The board can run it.」（替身 Agent 回答）。
   [照文档跑的命令](06-runtime-commands.log)

9. 点这一节最后一句的「chat」。
   `/docs/chat#a-model-per-conversation` 在新标签页打开；Runs 页留在原标签页。
   [标签页前后](07-chat-link.log)

## Feedback

- **一张表回答「我想…」**：看、停、续、重来四行一眼扫完，像操作指南。
- **图让「Runs」有了样子**：不同职业穿不同衣服、屏幕上各干各的活，一眼看出一次运行就是一个在干活的 Agent；名牌也换成了应用里真有的角色。但它是装饰，名牌、卡号太小要凑近才读得出，和表里的四件事也对不上。
- **图上的控件像能点**：「6 running」「Completed」两个页签和右上的 × 都画得像按钮；点页签没反应，鼠标也不变手形。
- **命令照抄就能跑**：四行运行时命令在新项目里一次跑通，`akb agent` 马上能看到 builder 换了运行时。
- **代码块被截断**：`akb agent set … https://my-gateway.example.com` 一行在 1280 宽下超出框（687/622px），要横向滚动才看到完整地址。
- **Retry 没说在哪**：表里和 Resume 并列，但命令行没有 `retry`；Resume 的「where supported」也没说哪里不支持。
- **页尾和 Chat 页说法不一**：这里说一段对话「can use a different agent or model」，Chat 页已改成选「runtime」。
- **更新日期没跟上**：页头仍写「Updated October 15, 2026」，10 月 20 日加了这张图、21 日又换了角色。
- **没有跑到的**：在应用的 **Runs** 面板里真的看日志、停、续跑一次运行，以及子运行的展示（见 skill、local-ui 模块的场景）。
