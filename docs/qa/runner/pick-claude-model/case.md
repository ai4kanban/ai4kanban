# 在运行时设置里选 Claude Code 的模型

## Setup

- Runner 已登录并在运行（见 [第一次启动 Runner 并登录](../sign-in-and-connect/case.md)），运行电脑上
  的 Claude Code 已登录，且打开过它的模型选择器（`~/.claude/cache/model-catalog/` 里有缓存）。
- 本地云端栈取证，网页端用同一栈的 vite；网页已切到中文。Runner 用临时的 `CLAUDE_CONFIG_DIR`，里面放一份
  真实的模型缓存，步骤 4、5 改的是这份。全局默认的模型从「默认模型」开始。

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
4. 不重启 Runner，让运行电脑上的模型缓存多一个新模型（取证时往缓存里加 `QA Next`），等下一次报到后
   重新打开设置和下拉框。
   预期：新模型出现在主列表里，手动输入的模型保留并选中。线上报到最长约 5 分钟，点「测试连接」可立即刷新；
   取证时 Runner 2 秒轮询一次，几秒内就到了。
   证据：[04-new-model.png](04-new-model.png)
5. 仍不重启，移走模型缓存，等下一次报到后重新打开下拉框。
   预期：下拉框回落为 Opus、Sonnet、Haiku；手动输入的模型照常保留并选中。
   证据：[05-no-cache.png](05-no-cache.png)

## Feedback

列表和本机 Claude Code 一模一样，缓存一变就跟着变，不用重启 Runner，这是最省心的部分。不足：列表变化时网页
没有任何提示，最长要等 5 分钟，打开设置时可能还是旧列表，用户不知道该等还是点「测试连接」。选中后「模型」
一行用等宽字体显示 `Fable`，和下拉框里的粗体名称不一致，看着像手输的 id；「其他…」的输入框预填当前模型，
直接打字会接在后面，要先全选。
