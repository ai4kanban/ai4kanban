# 让代理用中文回复和写卡

## Setup

- 已装好看板和 skill（见 [让编码代理能驱动看板](../install-agent-skill/case.md)），setup 已完成，
  本机 `claude` 已登录；看板上有一张英文标题、尚未规划的卡 #2 "Delete a note by number"。
- 本机语言写在 `~/.ai4kanban/settings.json` 的 `language` 里；`akb` 没有设置它的命令。

## Steps

1. 把 `language` 设为 `zh`，执行 `akb create "<一句话>" --print`。
   预期：打印的流程以一句「请用中文回复和写作。」结尾，不再有整段英文的语言说明。
   证据：[01-print-zh.log](01-print-zh.log)
2. 执行 `akb card refine 2`。
   预期：立刻返回运行 id 和跟随、停止它的命令。
   证据：[02-refine-zh.log](02-refine-zh.log)
3. 跟随运行到结束。
   预期：代理的回复是中文，运行显示 done、用时和花费。
   证据：[03-reply-zh.log](03-reply-zh.log)
4. 查看卡片并执行 `akb raw validate 2`。
   预期：正文是中文，`## Worth noting`、`## Scope`、`## Todo` 等小节标题和字段保持英文，校验通过。
   证据：[04-card-zh.log](04-card-zh.log)
5. 把 `language` 改回 `en`，再执行第 1 步的命令。
   预期：结尾没有任何语言指令。
   证据：[05-print-en.log](05-print-en.log)

## Feedback

效果干净：一句短指令就让回复、卡片正文全换成中文，标题仍是英文，卡片照常能读，切回英文也
立刻生效。不足：本地用户没有任何命令或界面能改语言，只能手改 `settings.json`；卡片标题仍是
原来的英文，中英混排；`## By \`api-designer\` agent` 这类段名在文件里照旧带 "agent"。
