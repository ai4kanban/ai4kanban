# qa-manager

- **子运行可能写错检出**：子运行的新场景有时落在主检出 `docs/qa/`（未跟踪），而不是交付工作树；收尾时查 `git -C <主检出> status docs/qa`，把它们挪进工作树再改索引。
- **分模块**：按 commit 改动的目录对照 `modules.md` 分；`web/content/docs/` 归 docs，`web/` 其余归 site，`cli/src/agents/` 归 skill；改 `web/components/shots/` 这类共用插图时，再 grep `docs/qa/docs/` 里引用它的场景，一并分给 docs。
- **子运行任务里写明工作树路径**：任务里点名交付工作树的绝对路径和 `.akb/qa/` 证据目录后，子运行都写对了地方；收尾再对一遍索引标题和场景标题，子运行改标题不会同步索引。
- **等子运行**：`run wait` 每次都会把已结束的再报一遍，循环等时传还在跑的 id，看 `still running:` 行判断。
- **只改 Pages Function 时不必重建官网**：拿 `/tmp/qa-site-*/web/out` 里晚于 `web/` 最近一次非函数提交的构建，配上 main 的 `web/functions/` 和 `wrangler.jsonc` 跑 `pages dev out` 即可。
- **zsh 不拆分变量**：`A="node …/ai4kanban.mjs"; $A raw list` 会被当成一个命令名报错；直接写全命令或用函数。`raw list` 的 `--dir` 放在子命令后。
- **收尾全量核对索引标题**：用脚本把索引里每条链接的标题和 `case.md` 首行逐条比对；旧的不一致（不是本轮子运行造成的）也会被查出来，顺手改掉。
- **用本次提交的 CLI 取证**：`git archive HEAD cli skill telemetry/contract.ts telemetry/package.json` 解到 `/tmp/qa-*`，链上主检出的 `cli/node_modules`，跑 `node scripts/build.mjs`；少了 `skill/` 或 `telemetry/contract.ts` 会构建失败。
- **子运行显示 interrupted 不等于没做完**：`run list` 标 `~ interrupted` 的子运行，`run wait <id>` 可能仍给出完整报告；先读报告、看工作树改动和证据目录，确认做完就不必接手。已被上一轮跟进过的卡（场景提交晚于卡的落地）不必再开子运行。
- **子运行可能卡在自己起的服务上**：`run log` 很久不动、证据和场景都已写完时，多半是它等的 `wrangler pages dev` 没退；直接 `run stop`，杀掉残留进程，自己核对它的改动后收尾。
- **新的 `AI4KANBAN_HOME` 先进英文的使用上报页**：取看板界面截图前，往它的 `settings.json` 写 `language: "zh"`、`usageDisclosureShown`、`welcomeTourShown` 为 true，才直接进中文看板。
