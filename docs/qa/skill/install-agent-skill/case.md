# 让编码代理能驱动看板

## Setup

- 已按 [在新项目里安装看板](../install-board/case.md) 装好看板，尚未装 skill。

## Steps

1. 执行 `akb skill`。
   预期：列出 `.claude/skills/kanban/`、`.agents/skills/kanban/`、`.git/hooks/pre-commit`
   均未安装，并提示 `akb skill install`。
   证据：[01-skill-status.log](01-skill-status.log)
2. 执行 `akb skill install`。
   预期：写入两份 SKILL.md 和 pre-commit 钩子，并给出一句可直接对代理说的话。
   证据：[02-skill-install.log](02-skill-install.log)
3. 再执行 `akb skill`。
   预期：三项都显示已安装（版本号），结论为 "Up to date"。
   证据：[03-skill-status-after.log](03-skill-status-after.log)
4. 查看 `.claude/skills/kanban/SKILL.md`。
   预期：是 `kanban` skill，`akb` 不在 PATH 时改用 `npx --yes wildcrane@<版本>`。
   证据：[04-skill-file.log](04-skill-file.log)

## Feedback

查看、安装、再确认三步清楚，"Now say this to your coding agent" 给了现成的第一句话，很顺手。
不足：一次装了七种代理的目录和一个 git 钩子，用户没有选择余地；钩子拦截提交的说明对首次
使用者偏抽象。
