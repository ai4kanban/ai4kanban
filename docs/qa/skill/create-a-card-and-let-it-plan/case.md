# 建一张卡，让看板把它规划好

## Setup

- **项目**：一个小的 git 项目（`tiny-notes`：`README.md`、`package.json`、`src/notes.mjs`），用 `akb install` 建好看板，删掉 `setup-checklist.md`，提交。
- **Agent**：默认的 Claude Code（`akb agent` 里 Global default），真实运行，要已登录。
- **终端**：zsh，在项目根目录，不在任何 Claude Code 会话里（否则看板会把那段对话当作建卡的讨论）；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb create "Rewrite the README so a new user can install tiny-notes and use add and list in under a minute"`。
   立即返回，打印 `create — run <id>` 和跟踪、停止这次运行的两条命令。
   [01-create.log](01-create.log)

2. 一分钟左右后执行 `akb run list`。
   只有这一次 `create`，已完成；后面没有另起的 `clarify` 或专项运行；`nothing running.`
   [02-runs.log](02-runs.log)

3. 执行 `akb run log <create 的 id>`。
   同一次运行里建卡后接着执行了 `akb card refine 2 --print`，回话说「Next I'm refining it … running the copywriting spec agent」；结尾说明卡片仍是 `todo`、留下一个问题，原因写清楚。
   [03-run-log.log](03-run-log.log)

4. 打开这次运行的 Claude Code 会话记录（`~/.claude/projects/<项目>/<run id>.jsonl`），看 agent 执行过的命令。
   `akb card refine 2 --print` 之后，同一个会话里执行了 `akb spec copywriting 2 "…" --print`，然后写卡片、`akb raw validate`。
   [04-session-commands.log](04-session-commands.log)

5. 执行 `akb raw list`。
   多出 #2「Rewrite the README as a one-minute quickstart」，状态 `todo`，带 `1 open question`，摘要是规划写的那句话（建卡时的标题已被改写）。
   [05-list.log](05-list.log)

6. 打开卡片文件。
   有 `## By \`copywriting\` agent` 一节（整份 README 草稿）、填好的 `## Scope` / `## Todo`；frontmatter 里一个 `[user]` 问题（从 npm 装还是从仓库副本装），推荐第一个，标着 `agent: copywriting`。
   [06-card.log](06-card.log)

## Feedback

- **一句话到「等我回答」只要一分钟**：建卡、细化、专项文案都在同一轮里完成，`run list` 上只有一行，比以前「建卡 → 排队规划 → 再排队专项」清爽得多。
- **回执仍不提后面还有规划**：`create` 的回执只说起了一次运行，看不出这一轮会一路做到细化和专项；要等结束读回话才知道卡片停在哪。
- **专项跑过没有在 `run log` 里露面**：`akb spec copywriting … --print` 被拼在一条长命令的末尾，`run log` 只显示截断的第一行，只能靠回话里一句「running the copywriting spec agent」或卡片上的那一节推断；要确认得去翻会话记录。
- **问题只能去文件里读**：`raw list` 只说有 1 个问题，看问题本身要打开卡片读 YAML。
- **一轮的花费看得见**：`run list` 直接给出时长和费用（这次 59 秒、$0.45），对「一轮更长」心里有数。
- **没有跑到的**：一次讨论建出多张卡（应各自 `--schedule refine`）、setup 种子卡的细化 fork setup 会话、在界面里建卡、其他 harness（Codex 等）上的同一流程。
