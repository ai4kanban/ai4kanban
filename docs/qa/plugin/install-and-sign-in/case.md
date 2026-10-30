# 安装 Claude Code 插件并登录

## Setup

- 用临时 `HOME`、`CLAUDE_CONFIG_DIR`、`WILDCRANE_HOME` 和占位 key；模型调用都失败，只验证插件自身。
- 本地 marketplace 代替 GitHub 上的（条目 `{"source":"url","url":"file:///…"}`），插件是本工作区的构建，版本 0.1.5。
- 本地云端栈，登录账号 alice。PATH 前放假的 `open` 记下登录地址，用 `curl` 打开它代替浏览器；
  GitHub 由替身代答。证据用 `tmux` 渲染。

## Steps

1. 运行 `claude plugin marketplace add`，再运行 `claude plugin install wildcrane@wildcrane`。
   预期：两条都成功，`claude plugin list` 显示 `wildcrane@wildcrane`、已启用。
   证据：[01-install.log](01-install.log)
2. 启动 Claude Code，等加载完，运行 `/wildcrane`。
   预期：面板打开，显示版本、一句说明和 **Sign in**。
   证据：[02-signed-out.png](02-signed-out.png)
   证据用不含 #127 的代码打包，所以在 `permissions.allow` 里放行了 `wildcrane_panel`；含 #127 的版本不再询问。
3. 按 Sign in。
   预期：按钮换成 `Waiting for the browser…` 和 `Open the sign-in page`，同时打开登录页。
   证据：[03-waiting-for-browser.png](03-waiting-for-browser.png)
4. 在浏览器里完成登录。
   预期：页面写着「已登录 WildCrane」，可以关闭。
   证据：[04-signed-in-page.png](04-signed-in-page.png)
5. 回到 Claude Code。
   预期：不用操作，面板换成四个标签页。这里项目目录在 `/tmp`，所以提示系统目录不能作项目。
   证据：[05-signed-in.png](05-signed-in.png)
6. 让登录没能完成（替身答的 token 里没有账号）。
   预期：浏览器页面写「登录未完成」，面板写 `Sign-in didn't finish. Try again.`，Sign in 回来了。
   证据：[06-sign-in-failed.png](06-sign-in-failed.png)
7. 已登录时按面板底部的 Sign out。
   预期：先询问，并说明这台电脑上正在运行的任务会停止。
   证据：[07-sign-out-asked.png](07-sign-out-asked.png)
8. 确认 Sign out。
   预期：回到第 2 步的未登录面板，本机 `session.json` 被删除。
   证据：[08-signed-out-again.png](08-signed-out-again.png)

## Feedback

从安装到看到面板只要两条命令，登录也顺：浏览器一回来面板自己就变了，不用再按什么。
但有两处会卡住新用户。Claude Code 刚启动时输入 `/wildcrane` 会跑成 `/wildcrane:clarify-idea`，
没有报错，只是开始了一轮对话，已送 triage。登录失败的提示不说原因，用户只能一遍遍重试。
