# 往待筛选里加一条，忽略它，再恢复

## Setup

- **看板**：刚用 `akb install` 建好，删掉了 `setup-checklist.md`，待筛选是空的。
- **终端**：zsh，在项目根目录；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb triage add --title "Search is slow on big boards" --text "…" --source "user email"`。
   回执 `added to triage: docs/kanban/triage/search-is-slow-on-big-boards.md`。
   [01-add.log](01-add.log)

2. 打开这个文件。
   frontmatter 有标题、来源和一个自动生成的 `source_id: derived-…`，正文是 `--text` 的原文。
   [02-item.log](02-item.log)

3. 原样再加一次。
   被拒绝（exit 1）：`that is already waiting in triage — …`，没有多出第二个文件。
   [03-add-again.log](03-add-again.log)

4. 执行 `akb triage dismiss <source_id> --reason "…"`。
   回执 `— ignored`，文件移到 `triage/dismissed/`，多出 `dismissed_at`、`dismissed_by: agent` 和原因。
   [04-dismiss.log](04-dismiss.log)

5. 执行 `akb triage restore <source_id>`。
   回执 `— back in triage`，文件回到 `triage/`，忽略的三行被清掉。
   [05-restore.log](05-restore.log)

6. 执行 `akb triage check <source_id>`。
   回答 `— pending` 和文件位置。
   [06-check.log](06-check.log)

## Feedback

- **加、忽略、恢复都一步到位**：每次回执都给出文件现在在哪，文件内容也和说的一致。
- **要自己去文件里抄 `source_id`**：`add` 的回执只给文件路径不给 id，而 `dismiss`、`restore`、`check` 都只认这个 `derived-…` 长串；按文件名或标题都不行。
- **人在命令行忽略也记成 `dismissed_by: agent`**：帮助里说这是「agent 的忽略」，人自己用时记录就不真实了，以后学习忽略偏好时会把人的判断算到 agent 头上。
- **重复添加的拒绝很友好**：直接指出已经在哪个文件里。
