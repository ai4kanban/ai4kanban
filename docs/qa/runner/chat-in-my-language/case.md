# 在任务对话里附图提问，Agent 用我的语言回答

## Setup

- Runner 已登录并在运行（见 [第一次启动 Runner 并登录](../sign-in-and-connect/case.md)），项目
  `demo-app` 已放到这台电脑上，里面有任务 DA-5，它的卡片是英文的。
- 本地云端栈取证；网页上的操作用对应的 API 代替。证据里的 `~` 是取证用的临时目录。

## Steps

1. 把网页界面切到中文。
   预期：账号语言记为 `zh`。
   证据：[01-language.log](01-language.log)
2. 在 DA-5 的对话里附一张写着「Version 2.7.1」的图，问「图里写的版本号是多少？一句话回答。」
   预期：Runner 领走回复，Agent 用中文回答 2.7.1，回复带花费和 token 用量。
   证据：[02-reply.log](02-reply.log)
3. 查看 Claude Code 收到的提示词。
   预期：Runner 加的卡片路径和附件列表在前，一行 `---` 之后是云端的提示词，「请用中文回复和写作。」
   是最后一行。
   证据：[03-prompt.log](03-prompt.log)
4. 用英文问一段夹着英文代码的问题，要求一句话回答。
   预期：回答是中文，`greet`、`"Ada"` 等标识符和字符串保持原文。
   证据：[04-code-reply.log](04-code-reply.log)
5. 查看这一轮 Claude Code 的启动参数和项目文件。
   预期：`--append-system-prompt` 里带语言要求，项目里没有多出文件。
   证据：[05-system-prompt.log](05-system-prompt.log)
6. 把网页切回英文，再问一次。
   预期：回答是英文，启动参数里没有 `--append-system-prompt`。
   证据：[06-english.log](06-english.log)

只在 Claude Code 上取证。Codex、Grok、OpenCode、Kimi、DSH 走同样的语言要求，本机没有可用的登录，没有跑
完整对话。

## Feedback

全英文的卡片和英文代码都没把回复带跑，语言要求进了系统提示词，这比只在消息末尾写一句可靠得多；切回英文也
立刻生效。不足：回复多了一句「这次没有改动卡片」，对只想要一句话答案的用户是噪音。系统提示词已经写了语言
要求，消息末尾的那句成了重复（作为兜底保留）。
