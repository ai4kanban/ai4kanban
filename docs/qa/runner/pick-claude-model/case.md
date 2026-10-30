# 在运行时设置里选 Claude Code 的模型

## Setup

- Runner 已登录并在运行（见 [第一次启动 Runner 并登录](../sign-in-and-connect/case.md)），运行电脑上
  的 Claude Code 已登录，且打开过它的模型选择器（`~/.claude/cache/model-catalog/` 里有缓存）。
- 本地云端栈取证，网页端用同一栈的 vite；网页已切到中文。

## Steps

1. 打开 设置 → 运行时 → 全局默认，点「模型」。
   预期：下拉框是「默认模型」加上本机 Claude Code 选择器主列表里的模型，名称一致（Opus、Fable、
   Sonnet、Haiku），缓存里的旧版本不在其中，最后是「其他…」。
   证据：[01-model-menu.png](01-model-menu.png)
2. 选 Fable，再打开下拉框。
   预期：「模型」一行显示 Fable，下拉框里的选中标记落在 Fable 上。
   证据：[02-fable-picked.png](02-fable-picked.png)
3. 点「其他…」，输入旧版本 `claude-opus-4-6` 回车，再打开下拉框。
   预期：「模型」显示 `claude-opus-4-6`，它作为单独一项出现在主列表下，带选中标记。
   证据：[03-older-by-hand.png](03-older-by-hand.png)
4. 在没有模型缓存的运行电脑上重启 Runner（取证时用空的 `CLAUDE_CONFIG_DIR` 加 API key 登录），
   重新打开下拉框。
   预期：下拉框回落为 Opus、Sonnet、Haiku；手动输入的模型照常保留并选中。
   证据：[04-no-cache.png](04-no-cache.png)

## Feedback

列表和本机 Claude Code 一模一样，Fable 也有了正式名称，不用再猜 `fable` 该怎么拼。不足：选中后
「模型」一行用等宽字体显示 `Fable`，和下拉框里的粗体名称不一致，看着像手输的 id；「其他…」的
输入框预填当前模型，直接打字会接在后面（取证时就拼成了 `fableclaude-opus-4-6` 并被保存），要先
全选。
