# 让软件规划师换用自己的 Agent 规划

## Setup

- **项目**：一次性 git 项目，只有一个打印 `hello` 的 `hello.py`；`akb install` 新装，删掉 `setup-checklist.md`，没有改过任何运行设置。
- **Agent**：规划助手和全局默认都是真实的 Claude Code；Codex 用 ChatGPT 应用自带、已登录的那个。
- **卡片**：`akb raw create --title "Print a greeting with the user's name"` 建的 #2，正文补一句：有参数就问候这个名字，没有就打印 `Hello, world`。
- **终端**：zsh，在项目目录里；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb agent`。
   `software-planner`、`blog-planner` 等规划者都标着 `— follows discussion-helper`。
   [01-agent.log](01-agent.log)

2. 执行 `akb agent runtime add Codex codex`，再 `akb agent bind software-planner codex`。
   绑定没有被拒绝：回执 `` `software-planner` runs "Codex" — codex ``；再看 `akb agent`，`software-planner` 一行变成 `Codex  codex`，不再标 follows，其他规划者照旧跟随规划助手。
   [02-bind-codex.log](02-bind-codex.log)

3. 执行 `akb card refine 2`。
   立即返回一次 `refine` 运行和跟踪、停止的两条命令。
   [03-refine.log](03-refine.log)

4. 运行结束后执行 `akb run log <id>`。
   首行是 `clarify #2  done  in 1m 22s  gpt-6.1-sol`，接着 `[board] new session — the earlier session was held by Claude Code, and this step runs on Codex`；规划由 Codex 完成，卡片标为 `ready`。
   [04-run-log.log](04-run-log.log)

5. 打开卡片 #2。
   Scope 和 Todo 已写好（输出一行问候、名字原样保留、多余参数忽略），没有待答问题。
   [05-card.log](05-card.log)

6. 执行 `akb agent bind software-planner -`。
   回执 `` `software-planner` runs what `discussion-helper` runs — claude-code here. ``；`akb agent` 里它又标回 `— follows discussion-helper`。
   [06-unbind.log](06-unbind.log)

## Feedback

- **想让某个规划者换代理，一条命令就够**：以前 `bind` 规划者被拒，现在直接生效，`-` 一键恢复跟随，回执说得清它现在跑什么。
- **换代理的代价写在日志里**：`new session … this step runs on Codex` 告诉用户这次没接续之前的会话，但只有翻 `akb run log` 才看得到，卡片上没有提示。
- **Codex 的日志很吵**：开头和中间夹着好几行 `rmcp::transport::worker … redirect` 报错，看起来像出错，其实规划照常完成。
- **Codex 留了个空段**：卡片上多出 `## By \`ui-designer\` agent`，只写一句「这个命令行改动不需要界面设计」，对用户没有信息量。
- **表里看不出谁是规划者**：`email-planner` 名字像规划者却不标 follows，用户得自己猜哪些行受规划助手影响。
- **没有跑到的**：恢复跟随后再规划一次、确认它接续讨论会话；在讨论里写成卡片后再交给单独设置的规划者；配置页上的选择（属于 local-ui）。
