# 让 Agent 接入全局记忆

## Setup

- **看板**：一次性 git 项目（`user.name` 设为 `qa`），`akb install` 新装，删掉 `setup-checklist.md`，建了 #2「Export to PDF」。
- **自建全局记忆**：手写 `docs/kanban/memory/glossary/MEMORY.md`（`name: glossary`，一句简介，一条约定）。
- **项目 Agent**：手写 `docs/kanban/agents/release-notes/AGENT.md`，`akb.hook: plan`，`akb.memory: [glossary, competitors]`。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令，`<project>` 是项目目录。

## Steps

1. 执行 `akb raw memory-file competitors`，再看 `docs/kanban/memory/`。
   打印内置全局记忆「竞品」的约定：`README.md` 索引的写法、每个竞品一个 `<slug>.md`（`last_read`、`## Features`、`## Sources`）、功能打勾的规则、三个月重新核实。看板里没有 `memory/competitors/` 文件夹。
   [01-built-in.log](01-built-in.log)

2. 执行 `akb spec competitor-research 2 --print`，看「global memories」一段。
   内置的竞品调研 Agent 收到一行 `competitors`：简介、`<project>/docs/kanban/memory/competitors/` 的绝对路径，以及读约定的命令 `akb raw memory-file competitors --dir <project>`。
   [02-competitor-research.log](02-competitor-research.log)

3. 执行 `akb workflow stage coding --stage plan --on release-notes`，再 `akb spec release-notes 2 --print`，最后 `akb raw memory-file glossary`。
   提示里两行：`glossary` 的约定写「`MEMORY.md` in that folder」，`competitors` 给出命令；`raw memory-file glossary` 打印自建的 `MEMORY.md`。
   [03-own-memory.log](03-own-memory.log)

4. 执行 `akb raw memory-file roadmap`；再把 Agent 的 `memory` 改成 `[glossary, roadmap]`，`akb spec release-notes 2 --print`。
   前者被拒绝（exit 1）：`"roadmap" is not a global memory on this board. It has: competitors, glossary.`；后者的提示里只剩 `glossary`，`roadmap` 被悄悄略过，没有任何提示。
   [04-unknown.log](04-unknown.log)

## Feedback

- **接入只要一行**：`memory: [名称]` 就让 Agent 拿到路径和约定，约定写一处，多个 Agent 共享。
- **写错名字不报错**：Agent 头部写了不存在的记忆名，运行照常、提示里少一项，用户发现不了自己拼错了。
- **新建要靠界面或手写**：命令行没有新建全局记忆的命令，`MEMORY.md` 的 frontmatter 要自己照着内置的写。
