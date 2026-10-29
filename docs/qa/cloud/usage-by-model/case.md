# 按模型查看工作区的用量和费用

## Setup

- 已登录的账号和它的工作区；同一天里用过 Opus（Claude Code）、Codex 和未指定模型的
  Claude Code 默认运行时。
- 未部署前用本地云端栈取证，数据由 [在任务对话里看每条回复花了多少钱](../reply-cost/case.md)
  的两个任务，加一个先用 Codex、再用默认运行时各聊一轮的任务构成。

## Steps

1. 请求 `GET /v1/workspaces/{id}/stats?from=2026-10-01&to=2026-10-30&tz=Asia/Shanghai`。
   预期：`models` 每个连接器和模型一行，带 `runs` 和 `costUsd`：Opus 4 次 $2.85，默认模型
   （`model: null`）1 次 $0.40，Codex 1 次、`costUsd` null；当天 `costUsd` 3.25 正好是各行
   之和，按每轮自己的费用计，没有重复计算累计额。
   证据：[01-stats.log](01-stats.log)
2. 换一个没有运行的时间段（2026-07）。
   预期：`data` 和 `models` 都是空数组。
   证据：[02-empty-range.log](02-empty-range.log)

## Feedback

一次请求就能回答「钱花在哪个模型上」，各行之和与每日费用对得上，可信。摩擦点：`models`
不排序，调用方得自己按费用排；Codex 只能看到次数，花了多少完全看不出；没指定模型的运行合成
「默认模型」一行，模型换代前后无法区分。网页统计页的排名表属于 web 模块，本用例未覆盖；
线上 Cloud 还没部署这次改动，以上全部来自本地栈。
