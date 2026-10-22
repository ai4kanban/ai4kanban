# Decisions

Settled user-facing answers for marketing. Read before proposing.

## How the work runs

- **Content work runs on the ordinary board** and default workflow; no second board or flow set.
- **A format change migrates the open cards**: the board never carries two card formats.
- **Instagram 参考帖下载**：用本机已登录的 Instagram 状态：从 Chrome 导出 cookies.txt，gallery-dl 用 `--cookies` 读，用完删掉；终端读不了 Chrome 的 cookie 库，`--cookies-from-browser` 无效。
- **自定义工作流的自动选择**：靠工作流名称和负责 agent 的描述自动选中，不为此加产品规则。

## awesome-agent-kanban

- **Categories follow what the reader hands over**, never UI/CLI/MCP; a category needs a complete,
  usable workflow, and listing in several is not a ranking.
- **Only tools where an agent really does the work**, every claim backed by docs, source or a
  reproducible flow.
- **AI4Kanban gets no advantage**: same criteria and entry shape, no pin, badge or marketing copy.
- **English only, hand-maintained**: one README, no automation, CI, badge wall or star ranking.

## The newsletter

- **周报发送**：随版本发布，由用户手动发送；agent 只准备到测试邮件通过为止。
- **Subscriber list**: stays on the user's machine with an encrypted backup, never in git or a hosted service.
- **宣传里的成本倍数**：取自 `test-ai4kanban` 的最新重测，结果记在它的 README。

## The demo video

- **只做一支**：英文旁白，同一工程渲染英文字幕版和中文字幕版，官网、Product Hunt 与中文渠道共用。
- **被演示的产品**：用专门搭建的独立演示项目，不拿 AI4Kanban 自身开发做演示。
- **素材**：在本地 `assets/video/` 审阅，定稿后上 CDN。
- **片中的 AI4Kanban 界面**：所有宣传视频都用真实界面配演示数据导出，不手写重画；界面改版后重新导出。

## The pitch deck

- **投资人路演页**：包含竞品对比页（结论取官网对比页）和融资需求页；不放没有可靠来源的市场规模页。
- **下一步方向**：聚焦开发 + 营销，营销从编程化视频切入（列 faceless 口播等类目），还没有工作流的类目标为计划。
- **里程碑**：至多 3 个月内达到目标量级，不写 12 个月。
- **不强调内置工作流的数量**：工作流还在快速增加，只讲每个工作流替人提取审阅重点。

## Positioning

- **目标用户**：每月花 $200 用 Claude Code / Codex、30 岁以上、时间有限、缺技术背景或没空研究技术、既要开发又要营销的人；场景如传统行业做 SaaS、上班族做副业产品、讲师搭内容工厂兼 vibe coding。
- **市场切入**：Coding 是当前主场景，切入开发与营销的交集——不是纯开发或纯营销工具，而是一套范式让多类工作流在一个平台上并行（类比 Notion）；判断是单项任务价值会降低，多任务并行的平台价值上升。
- **Why now**：人与 Agent 的责任边界一直存在，被「一句话全自动」的幻象忽视；变化在于 Agent 指令跟随变强，确认后的草稿能隐藏更多执行细节。哪些细节交给人，靠真实工作流和社区积累，这是壁垒。

## 图文模板

- **每页图片位数量**：由每个模板自己定，模板设计规则不限定；从零设计时的默认页型写在单独的默认准则里，按需读取。
