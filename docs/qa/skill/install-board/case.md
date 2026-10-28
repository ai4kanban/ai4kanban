# 在新项目里安装看板

## Setup

- 一个 `git init` 过、还没有看板的项目，`akb` 在 PATH 上。

## Steps

1. 在项目根目录执行 `akb install`。
   预期：提示在 `docs/kanban/` 建好看板，给出下一步 `project`，并说明唯一写在看板外的是
   `.gitignore` 里的 `.akb/`；最后提示用 `akb skill` 接上编码代理。
   证据：[01-install.log](01-install.log)
2. 查看 `docs/kanban/` 和 `git status`。
   预期：有 `config.md`、`modules.md`、`setup-checklist.md`、`memory/`、`todo/`（含一张
   setup 问题卡）；改动只有 `docs/` 和 `.gitignore`。
   证据：[02-files.log](02-files.log)
3. 再执行一次 `akb install`。
   预期：提示看板已存在、什么都不做，退出码 0。
   证据：[03-install-again.log](03-install-again.log)
4. 进入子目录 `docs/` 执行 `akb run list`。
   预期：找到上层的看板，回答没有运行中的任务。
   证据：[04-run-list-from-subdir.log](04-run-list-from-subdir.log)

## Feedback

安装快、可重复执行，输出把"写了什么、写在哪"讲清楚了。不足：输出还在引导用户去"board UI
(Configuration → Agent setup)"，而新产品里本地看板界面已不存在，用户找不到这个按钮；第 1 行
"`setup-done <step>` ticks one" 是给代理看的内部说明，对用户是噪音。
