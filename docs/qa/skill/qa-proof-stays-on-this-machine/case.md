# QA 管理员跑一遍，场景进 git，证据留在本机

## Setup

- **看板**：一次性 git 项目（`user.name` 设为 `qa`），`akb install` 新装，删掉 `setup-checklist.md` 后提交。
- **Agent**：用本目录的 [stand-in.mjs](stand-in.mjs) 顶替 QA 管理员（不需要账号）——在 `<project>/.akb/boards/docs/kanban/ui.config.json` 写 `{"harness":"claude-code","harnessSettings":{"claude-code":{"command":"node <路径>/stand-in.mjs <存提示词的目录>"}}}`。它照提示词的 Proof 规则做：在工作目录写一个 `docs/qa/demo/open-the-app/case.md`，把证据写进开场白给出的项目下的 `.akb/qa/demo/open-the-app/`，并留下收到的提示词。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME`（空目录）和 `AI4KANBAN_HOME`；日志里的 `akb` 就是这次构建出的命令，`<project>` 是项目目录。

## Steps

1. 执行 `akb workflow schedule coding --run qa-manager`，几秒后看 `akb run list` 和 `akb run log`。
   运行 `done`；它在 `<project>/.akb/worktrees/delivery/<id>` 里工作，证据写到 `<project>/.akb/qa/demo/open-the-app`。
   [01-run.log](01-run.log)

2. 看 QA 管理员收到的提示词。
   开场白给出项目的绝对路径；Proof 规则写着按文件名链接、存进项目的 `.akb/qa/` 里与 `case.md` 同名的 `<module>/<case>/`、`proof is never committed`、重跑先清空。
   [02-proof-rule.log](02-proof-rule.log)

3. 看 `git log --stat -1`、`.akb/qa` 下的文件、`.gitignore` 和 `git worktree list`。
   运行的提交 `qa-manager: scheduled run (Coding)` 只有 `docs/qa/demo/open-the-app/case.md`；证据 `01-start.log` 在 `.akb/qa/` 下，被 `akb install` 写的 `.akb/` 忽略规则挡在 git 外；运行的工作区已清掉。
   [03-git.log](03-git.log)

## Feedback

- **仓库不再膨胀**：场景照常 review、diff，截图和日志只在本机；装好看板就已忽略 `.akb/`，不用另配。
- **证据换台机器就没了**：clone 下来的人只看得到步骤，看不到证据；`case.md` 里的链接在 GitHub 上全是死链。
- **证据的局限**：QA 管理员由替身顶替，验证的是看板给它的指示和提交的内容，不是真实 agent 会不会照做。
