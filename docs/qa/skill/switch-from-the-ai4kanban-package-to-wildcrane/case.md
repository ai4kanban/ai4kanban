# 从 ai4kanban 包换装 wildcrane 包

## Setup

- **旧包**：全局装着 npm 上的 `ai4kanban@0.11.2`，`akb` 指向它。
- **新包**：这次构建 `npm pack` 出的 `wildcrane-0.11.2.tgz`。
- **项目**：一个已装好看板的 git 仓库；终端 zsh，在项目根目录。

## Steps

1. 旧包还在时执行 `npm install -g wildcrane-0.11.2.tgz`。
   失败，`npm error code EEXIST`，指出 `<prefix>/bin/akb` 已存在，exit 1。
   [01-install-over-old.log](01-install-over-old.log)

2. 执行 `npm uninstall -g ai4kanban`，再装一次新包。
   安装成功；`<prefix>/bin` 下只有 `akb` 和 `wildcrane`，两者 `--version` 都是 `0.11.2`，`which ai4kanban` 找不到。
   [02-uninstall-then-install.log](02-uninstall-then-install.log)

3. 执行 `akb skill install`。
   首行是 `wildcrane 0.11.2 — adding the coding agent skill to <项目>`，写好 `.claude/skills/kanban/`、`.agents/skills/kanban/` 和 pre-commit 钩子。
   [03-skill.log](03-skill.log)

4. 看项目里 `SKILL.md` 的命令说明。
   `akb` 不在 `PATH` 时改用 `npx --yes wildcrane@0.11.2`。
   [04-skill-note.log](04-skill-note.log)

5. 执行 `akb guide update`。
   升级命令是 `npm install -g wildcrane@latest`，并写明还在用旧 `ai4kanban` 包的先 `npm uninstall -g ai4kanban`，因为两者都装 `akb`。
   [05-guide-update.log](05-guide-update.log)

6. 执行 `akb update`。
   首行是 `wildcrane 0.11.2 — updating <项目>`，刷新两处 `SKILL.md`；末行的升级提示是 `npm install -g wildcrane@latest`。
   [06-update.log](06-update.log)

## Feedback

- **改名很彻底**：回执、skill 说明、升级提示都换成了 `wildcrane`，不会再引导人装回旧包。
- **`akb` 照旧**：换包后日常命令一个字不用改，看板和卡片也不受影响。
- **直接覆盖装会卡住**：旧包占着 `akb`，npm 只报 `EEXIST` 并建议 `--force`，不说是旧包占着；而 `akb update` 的提示只有一行 `npm install -g wildcrane@latest`，没提先卸旧包。只有 `akb guide update` 讲了这一步，大多数人不会先去读它。
