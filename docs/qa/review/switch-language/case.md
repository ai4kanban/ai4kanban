# 切换任务页的语言

## Setup

- 本地云端栈（见 README「如何运行取证」），以发起人 alice 登录，打开任务「重新设计结账页」的
  任务页，页面是中文。
- 用假 Runner 代替真电脑：只看它领到的作业里 Cloud 写给 AI 的语言指令，回复由脚本代写。

## Steps

1. 点右上自己的头像。
   预期：菜单里有「语言」和当前的「中文」，还有账单入口，最下面是「退出登录」。
   证据：[01-menu.png](01-menu.png)
2. 把语言选成 English。
   预期：页面重新载入为英文（Share、Implement、Discuss with AI）。
   证据：[02-english.png](02-english.png)
3. 打开对话，发「Should the address step autofill?」。
   预期：对话框是英文，回复正常出现。
   证据：[03-reply.png](03-reply.png)
4. 查看 Runner 领到的这条作业。
   预期：语言指令是「Reply and write in English.」；账户上记下的语言是 `en`。
   证据：[04-chat-job.log](04-chat-job.log)
5. 不经过页面、直接给项目派一个作业（如规划后自动接着跑的下一步）。
   预期：语言指令同样是英文。
   证据：[05-no-page-job.log](05-no-page-job.log)
6. 在头像菜单里切回中文，再派一个不经过页面的作业。
   预期：页面回到中文，账户语言变 `zh`，作业的语言指令是「请用中文回复和写作。」。
   证据：[06-back-to-zh.log](06-back-to-zh.log)

## Feedback

一个下拉框同时决定界面和 AI 的语言，连没经过页面的后续步骤也跟着走。摩擦点：语言藏在头像菜单里，第一次找不到；
切换会整页重载；本用例没有真实的 AI，回复语言只验证到 Cloud 发出的指令为止。
