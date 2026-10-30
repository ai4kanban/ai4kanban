# 在 Claude Code 面板里看到新版本并升级

## Setup

- 取证用 `CLAUDE_CONFIG_DIR` 指向临时目录、占位的 `ANTHROPIC_API_KEY`（面板不调用模型），
  `WILDCRANE_HOME` 指向临时目录，未登录。
- 本地 marketplace 名为 `wildcrane`，插件条目用 `{"source":"url","url":"file:///…"}` 指向本地 git
  仓库，按版本缓存，和正式安装一样；`plugin.json` 改成 0.1.0 后安装。线上发布清单是 0.1.4，所以
  新版本号是真实查询得到的。
- 手动模式下首次打开面板，Claude Code 会询问 `wildcrane_panel` 工具的权限，选 Yes。

## Steps

1. 在 Claude Code 里运行 `/wildcrane`。
   预期：标题行显示 `v0.1.0`；顶部灰色边框的提示框写着 `Version 0.1.4 is available`，下面是两条
   升级命令和 /reload-plugins 步骤；面板其他内容照常。
   证据：[01-update-offered.png](01-update-offered.png)
2. 在终端执行提示框里的两条命令。
   预期：插件从 0.1.0 更新到 0.1.4。
   证据：[02-update-commands.log](02-update-commands.log)
3. 回到 Claude Code 运行 `/reload-plugins`，看着开着的面板。
   预期：提示框消失，版本号变为 `v0.1.4`。
   证据：[03-after-reload.png](03-after-reload.png)
   **当前失败**：插件和它的服务已换成 0.1.4，但开着的面板仍显示 `v0.1.0` 和提示框，等 25 秒也不变，
   已送 triage。
4. 再运行一次 `/wildcrane`。
   预期：标题行显示 `v0.1.4`，没有提示框。
   证据：[04-after-reopen.png](04-after-reopen.png)

## Feedback

版本号就在标题旁，不抢眼；提示框的命令能直接抄，灰色边框也不会被当成故障。最大的问题在最后一步：
用户照做完，面板还在说有新版本，看起来像升级失败，容易再跑一遍命令；要想到重新打开面板才对得上。
另外 `claude plugin update` 打印 `Restart to apply changes`，和提示框说的 /reload-plugins 不一致。
手动模式下，首次打开和每次 reload 后面板都先弹权限询问，把内部用的 `key` 明文摆在对话区，面板本身
只有一行标题，用户不知道为什么要批准一个写着 "Never call it" 的工具。
