# 在新项目里装好看板

## Setup

- **项目**：一个只有一次提交（`README.md`）的 git 仓库，还没有看板。
- **终端**：zsh，在项目根目录；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb install`。
   打印 `initialised board at docs/kanban/`，说明设置卡是 #1、下一步是 `project`（在 `docs/kanban/config.md` 写清这是什么项目），并提示用 `akb skill` 给编码 agent 装上 skill。
   [01-install.log](01-install.log)

2. 看项目里多了什么。
   只新增 `.gitignore`（一行 `.akb/`）和 `docs/`；`docs/kanban/` 下有 `config.md`、`modules.md`、`setup-checklist.md`、`todo/` 等。
   [02-what-changed.log](02-what-changed.log)

3. 执行 `akb raw list`。
   看板上有一张打开的卡：#1「Answer the questions setup couldn't settle」，`todo`、优先级 high。
   [03-first-card.log](03-first-card.log)

4. 不带参数执行 `akb`，再执行 `akb raw`。
   两次都打印与 `--help` 相同的用法和命令列表，exit 0，stderr 为空。
   [04-bare-akb.log](04-bare-akb.log)

## Feedback

- **安装很安静**：只写 `docs/kanban/` 和 `.gitignore` 的一行，并明说了这一点，不用担心它动了别的文件。
- **下一步说得清楚**：回执直接点出下一步是谁做、写在哪个文件，不用去翻文档。
- **设置还没完**：装完只勾了七步里的两步，剩下的写在 `setup-checklist.md` 里，命令行用户得自己去读 `akb guide setup`。
- **光打 `akb` 就有答案**：装完敲一下命令名就看到全部命令，不再像装坏了。
- **命令列表偏长**：根命令二十多项，`raw` 的说明自己也写着"a person never has to type one"，新用户很难一眼找到该先用哪个；列表里没有指向 `akb create` 或看板界面的起步提示。
