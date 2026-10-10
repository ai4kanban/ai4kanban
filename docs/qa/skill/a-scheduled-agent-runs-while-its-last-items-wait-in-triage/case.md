# 周期 Agent 上一轮的待筛选条目还没处理，它照样按周期运行

## Setup

- **看板**：一次性 git 项目（`user.name` 设为 `qa`），`akb install` 新装，删掉 `setup-checklist.md`。
- **周期 Agent**：手写 `docs/kanban/agents/changelog-keeper/AGENT.md`——`akb.hook: schedule`，正文一句「每张自上次运行以来落地的卡在 `CHANGELOG.md` 加一行」；连同看板一起提交。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替真实的 Agent（不需要账号）——在 `<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs"}}}`。它说出收到的开场白，什么都不改就结束。
- **上一轮的条目**：命令行没有让运行写待筛选的入口，用 `akb triage add` 加一条，再在文件里补上 `agent: changelog-keeper`，顶替它上一轮放进待筛选的条目。
- **定时器**：不开界面；用本目录的 [tick.mjs](tick.mjs) 顶替界面每分钟一次的巡检，只打印看板此刻会启动什么。新看板每次都还想跑一次 `describe-project`，与本用例无关。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令，`<project>` 是项目目录。

## Steps

1. 执行 `akb workflow schedule coding --on changelog-keeper --cadence 1m`，再 `--run changelog-keeper`，几秒后看 `akb run list`、`akb run log` 和列表。
   运行 `done`，日志里是 Agent 收到的开场白；列表变成 `every 1m · last run <时刻> · next after <一分钟后>`。
   [01-first-run.log](01-first-run.log)

2. 加入它上一轮的条目并提交，看 `docs/kanban/triage/`。
   有一条 `CHANGELOG.md has no release headings`，frontmatter 里 `agent: changelog-keeper`，没人处理。
   [02-left-in-triage.log](02-left-in-triage.log)

3. 等 65 秒，列一次周期 Agent，再跑 `tick.mjs`。
   列表那一行后面没有任何等待原因（以前会是 `(its last items are not handled yet)`）；要启动的清单里有 `{"action":"scheduled","workflow":"coding","specAgent":"changelog-keeper"}`。
   [03-still-due.log](03-still-due.log)

## Feedback

- **不再被一条没回答的问题卡住**：待筛选里堆着上一轮的条目，周期 Agent 照样按时跑，回顾和 QA 不会停摆。
- **待筛选会越积越长**：唯一的刹车是「有新输入」和周期；一直不筛选的话，列表只会变长，命令行里也没有一个地方提醒你待筛选里已经有多少条。
- **没有命令列出待筛选**：`akb triage` 只有 `add` 和 `fetch` 一类动作，想看有什么得直接翻 `docs/kanban/triage/` 或开界面。
