# 第一次启动 Runner 并登录

## Setup

- 本机装了 Node 22+ 和已登录的 `claude`，从未登录过 Runner（`~/.wildcrane/` 为空）。
- 本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 runner 一条）；GitHub 授权由替身
  代答，浏览器直接打开 Runner 的回调地址。

## Steps

1. 执行 `wildcrane-runner`。
   预期：终端提示去浏览器登录并打印登录地址，同时自动打开浏览器到这个地址。
   证据：[01-first-start.log](01-first-start.log)
2. 在浏览器里完成 GitHub 授权。
   预期：页面显示「Signed in to WildCrane」，提示可以关掉页面。
   证据：[02-signed-in.png](02-signed-in.png)
3. 回到终端。
   预期：依次显示 `Signed in` 和 `Connected (<电脑名>) — waiting for tasks`；网页端读到这台电脑、
   Runner 版本和本机每个 AI 工具是否已安装、已登录。
   证据：[03-connected.log](03-connected.log)
4. 按 Ctrl-C 后再执行一次 `wildcrane-runner`。
   预期：不再要求登录，直接显示 `Connected`。
   证据：[04-restart.log](04-restart.log)
5. 运行中按 Ctrl-C。
   预期：显示 `Stopped` 并退出。
   证据：[05-stop.log](05-stop.log)

## Feedback

一条命令、一次浏览器授权就连上，之后启动不再打扰，终端只有一行状态，很省心。不足：登录地址
是一长串 OAuth 参数，浏览器没自动打开时用户只能整段复制；`Connected` 之后终端没有提示下一步
去哪里（比如打开网页端），第一次用的人不知道接下来做什么。AI 工具列表里不少是 `loggedIn: null`
（查不出是否登录），网页端如何呈现这一点本用例未覆盖。
