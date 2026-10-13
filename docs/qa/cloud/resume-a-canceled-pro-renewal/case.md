# 在 Cloud 看板网站恢复已取消的 Pro 续费

## Setup

- **账号**：已在 Cloud 看板网站登录（见 [登录](../sign-in-to-the-hosted-board/case.md)），Pro · 按月，自动续费中（见 [查看套餐并购买 Pro](../check-your-plan-and-subscription/case.md)）。
- **本次证据的来源**：网站（`cloud-ui`）在本地实跑，[stand-in.mjs](../sign-in-to-the-hosted-board/stand-in.mjs) 顶替 Cloud 和 Creem：它的客户门户只有一个「Cancel renewal」链接，用 `--fail-resume` 启动时第一次恢复续费会失败。定价页的「购买 Pro」直接打开网站的 `/billing/checkout?period=yearly`，没有构建官网。

## Steps

1. 按「管理账单」，在 Creem 门户里取消续费，回到设置页。
   套餐显示「Pro · 按月」「2027年10月4日到期，不再续费。」，下方一行是强调色「恢复续费」和「管理账单」。
   [01-cancel.log](01-cancel.log)
   ![](01-canceled.png)

2. 在定价页按「购买 Pro」。
   回到设置页，套餐卡片顶部是提示「Pro 仍在有效期内，恢复续费即可继续使用。」，不会再走一次结账。
   [02-get-pro.log](02-get-pro.log)
   ![](02-still-active.png)

3. 按「恢复续费」，Creem 出错。
   仍在设置页，按钮下方显示「无法恢复续费，请重试。」，套餐保持「到期，不再续费」。
   [03-resume-failed.log](03-resume-failed.log)
   ![](03-resume-failed.png)

4. 再按「恢复续费」。
   回到设置页，套餐显示「2027年10月4日自动续费」，「恢复续费」消失，只剩「管理账单」，不出现「确认中」。
   [04-resumed.log](04-resumed.log)
   ![](04-resumed.png)

## Feedback

- **一键恢复，不用离开网站**：取消后反悔只要按一下，比进 Creem 门户找设置省事得多。
- **提示和按钮说的是同一件事**：「恢复续费即可继续使用」紧挨着同名按钮，下一步很明确。不过 Pro 在到期前本来就能继续用，「即可继续使用」读起来像现在已经不能用了。
- **失败可以直接重试**：错误就在按钮下面，按钮本身就是重试；只是不说为什么失败，连续失败时用户无从下手。
- **未在真实 Cloud 上验证**：门户、取消和 Creem 的 resume 接口都是替身，真实的 Creem 状态流转（`scheduled_cancel` → `active`）和真实的出错情形没有走过。
