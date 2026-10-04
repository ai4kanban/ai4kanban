# Decisions

Settled user-facing answers for telemetry. Read before proposing.

- **内部运营数字放进 telemetry 数据页**：如 AI 调用成本，和其他指标同一页显示，不另做命令行报表。
- **用户自己起名的模型名**：公开服务商的原样上报，自定义端点一律报 `custom`。

## The service

- **Workers free plan**: a day past its allowances loses events rather than billing; move to
  Paid only when the numbers force it.
- **A fix to the nightly summaries ships the day it is built**, by hand, not with the next
  release: the summaries backfill only nine days.

## Reading the numbers

- **The team reads them on a local page** from the reader's own machine and `.env`, never hosted,
  no sign-in.
- **Only the cumulative install count is public**, for the README badge, shown as the real
  count however far below downloads it sits.
