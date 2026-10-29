# 构建一张卡并跟随到落地

## Setup

- 接 [让代理用中文回复和写卡](../reply-in-my-language/case.md)：卡 #2 已规划好、状态 ready，
  语言为 `en`，项目在 `main` 上。

## Steps

1. 执行 `akb card implement 2 --follow`。
   预期：给出运行 id 和交付 id，在独立 worktree 里构建，并持续打印代理的动作。
   证据：[01-implement-follow.log](01-implement-follow.log)
2. 构建期间在 `main` 上提交一处改同一文件 `notes.js` 的改动。
   预期：pre-commit 钩子提示交付正在往 `main` 落地并拒绝；用 `--no-verify` 才提交成功。
   证据：[02-move-main.log](02-move-main.log)
3. 继续看第 1 步的跟随输出。
   预期：构建 done 后自动跑一次合并后检查（`conflict #2`），检查一结束就打印
   `delivery …: landed as <commit>`，跟随以退出码 0 结束，中间没有 "did not land"。
   证据：[03-check-then-land.log](03-check-then-land.log)
4. 查看 `main` 的提交、`akb run list` 和看板。
   预期：落地提交在第 2 步的提交之后、检查结束后数秒内出现；卡片进了 `.archive/`，worktree 已清理。
   证据：[04-landed.log](04-landed.log)

## Feedback

一条命令从构建跟到落地，`main` 中途被改也不用管：检查跑完立刻落地，全程约 1 分钟、两次运行
共约 0.6 美元，结论清楚。钩子拦住手动提交的提示也说清了原因和出路。不足：跟随输出里检查运行
的说明较长，用户只关心"没冲突、已落地"；落地进行中的 "Landing on `main`" 状态和卡住 10 分钟
报失败这两条路径本次没有遇到，未取证。
