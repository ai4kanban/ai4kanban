# 把 draft-first 装进项目，再加一个自己的 helper

## Setup

- **项目**：一个已有提交的 git 仓库（一个小命令行 `mycli`），没有看板。
- **命令**：`draft-first` 还没发布到 npm（#1632 推迟发布），日志里的 `npx draft-first` 由一个替身 `npx` 转到 [ai4kanban/draft-first](https://github.com/ai4kanban/draft-first) 这次构建的 `bin/draft-first.mjs`；发布后直接用真的 `npx`。

## Steps

1. 在项目根目录执行 `npx draft-first install`。
   打印两行 `✓`：`.claude/skills/draft-first`（Claude Code）和 `.agents/skills/draft-first`（Codex、Cursor、OpenCode 等），以及版本 0.1.0 和「Add your own helpers in .draft-first/helpers/」。两处各只有 `SKILL.md`、6 个 helper 和 2 个脚本。
   [01-install.log](01-install.log)

2. 再执行一次 `npx draft-first install`。
   照样打印两行 `✓`，不报错；`review.mjs` 里记着安装时的版本 `const VERSION = "0.1.0";`。
   [02-reinstall.log](02-reinstall.log)

3. 执行 `node .claude/skills/draft-first/scripts/helpers.mjs`。
   列出 6 个自带 helper：`competitor-research`、`copywriting`、`illustrator`、`prompt-writer`、`tech-stack-advisor`、`ui-designer`，每个一行文件路径、一行它覆盖的范围。
   [03-list-helpers.log](03-list-helpers.log)

4. 在 `.draft-first/helpers/` 写 `copywriting.md`（同名，改成只管命令行输出文案）和新的 `config-key.md`，然后在子目录 `src/` 里再列一次。
   `copywriting` 指向项目里的文件、描述换成自己写的；末尾多出 `config-key`；其余 5 个仍是自带的，共 7 个。
   [04-own-helpers.log](04-own-helpers.log)

## Feedback

- **一条命令装好两类 agent**：Claude Code 和其他 agent 各得一份，回执逐行写明给谁用，不用自己挑目录。
- **装进去的东西很少**：只有说明、helper 和两个脚本，能放心随项目提交。
- **自定义 helper 门槛低**：一个带 `description` 的 Markdown 文件就行，同名即覆盖，在子目录里也找得到。
- **列表看不出谁被覆盖了**：被替换的 `copywriting` 只能从路径看出来源，没有「项目覆盖」之类的标记。
- **现在还装不上**：包没发布，照 README 敲 `npx draft-first install` 会 404；这一步只能用本地包代替。
