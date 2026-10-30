# 让代理用中文回复和写卡

## Setup

- 已装好看板和 skill（见 [让编码代理能驱动看板](../install-agent-skill/case.md)），setup 已完成，
  本机 `claude` 已登录；看板上有三张英文标题、英文正文（含英文报错和代码）、尚未规划的卡 #9、#10、#11。
- 本机语言写在 `~/.ai4kanban/settings.json` 的 `language` 里；`akb` 没有设置它的命令。
- PATH 最前放一个记录启动参数再转给真 `claude` 的脚本，用来查看系统提示词。

## Steps

1. 把 `language` 设为 `zh`，执行 `akb create "<一句话>" --print`。
   预期：打印的流程以一句「请用中文回复和写作。」结尾。
   证据：[01-print-zh.log](01-print-zh.log)
2. 执行 `akb card refine 9`。
   预期：立刻返回运行 id 和跟随、停止它的命令；`claude` 的启动参数带 `--append-system-prompt`，
   内容是不论上下文什么语言都用中文，代码、命令、文件名和字段名保持原文。
   证据：[02-refine-zh.log](02-refine-zh.log)
3. 跟随运行到结束。
   预期：代理的回复是中文，`readNotes()`、`search` 等标识符保持原文，运行显示 done、用时和花费。
   证据：[03-reply-zh.log](03-reply-zh.log)
4. 查看卡片并执行 `akb raw validate 9`。
   预期：英文卡片的正文改写成中文，`## Worth noting`、`## Scope`、`## Todo` 等小节标题和字段保持英文，校验通过。
   证据：[04-card-zh.log](04-card-zh.log)
5. 对 #10 执行 `akb card refine 10`，中途 `akb run stop`，再 `akb run resume`。
   预期：续跑的启动参数同样带系统提示词，回复仍是中文。
   证据：[05-resume-zh.log](05-resume-zh.log)
6. 查看项目和 `~/.ai4kanban`。
   预期：项目里 `docs/kanban` 以外没有改动，没有多出规则文件。
   证据：[06-no-new-files.log](06-no-new-files.log)
7. 把 `language` 改回 `en`，再执行第 1 步的命令。
   预期：结尾没有任何语言指令。
   证据：[07-print-en.log](07-print-en.log)
8. 执行 `akb card refine 11`。
   预期：启动参数不带 `--append-system-prompt`，回复和卡片是英文。
   证据：[08-refine-en.log](08-refine-en.log)

未覆盖：只跑了 Claude Code。Codex、Grok、OpenCode、Kimi、DSH 的系统提示词入口本机没有实际跑通；
ZCode、Cursor 只靠结尾那一句。任务页对话框走 Runner，见
[在任务对话里附图提问，Agent 用我的语言回答](../../runner/chat-in-my-language/case.md)。

## Feedback

- **更稳了**：卡片和报错全是英文，回复、卡片正文仍是中文，标识符原样；停下再续跑也不变，切回英文立刻生效。
- **用户看不见这层保证**：系统提示词只在启动参数里，出了问题无从判断它有没有生效。
- **各工具不一样**：ZCode、Cursor 只有结尾一句，换工具后可能又回到英文，界面上没有提示。
- **还是不能改语言**：本地用户没有命令或界面设置语言，只能手改 `settings.json`；卡片标题仍是原来的英文，中英混排。
