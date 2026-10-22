# 在 Cloud 看板网站恢复已取消的 Pro 续费

## Setup

- **账号**：已在 Cloud 看板网站登录（见 [登录](../sign-in-to-the-hosted-board/case.md)），Pro · 按月，自动续费中（见 [查看套餐并购买 Pro](../check-your-plan-and-subscription/case.md)）。
- **本次证据的来源**：网站（`cloud-ui`）在本地实跑，[stand-in.mjs](../sign-in-to-the-hosted-board/stand-in.mjs) 顶替 Cloud 和 Creem：它的客户门户只有一个「Cancel renewal」链接，用 `--fail-resume` 启动时第一次恢复续费会失败。定价页的「免费试用 7 天」直接打开网站的 `/billing/trial`，没有构建官网。[run.mjs](../check-your-plan-and-subscription/run.mjs)（`node run.mjs resume …`）用无头 Chrome 跑下面各步。

## Steps

1. 按「管理账单」，在 Creem 门户里取消续费，回到设置页。
   套餐显示「Pro · 按月」「2027年10月4日到期，不再续费。」，下方一行是强调色「恢复续费」和「管理账单」。
   [01-cancel.log](01-cancel.log)
   ![](01-canceled.png)

2. 在定价页按「免费试用 7 天」。
   回到设置页，套餐上方显示绿底提示「Pro 仍在有效期内，恢复续费即可继续使用。」，套餐和「恢复续费」「管理账单」都不变，不会开始试用或走结账。
   [02-pricing-trial.log](02-pricing-trial.log)
   ![](02-pricing-trial.png)

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
- **从定价页回来会指向恢复续费**：按定价页的「免费试用 7 天」回来，提示直接说 Pro 仍有效、恢复续费即可，下面就是「恢复续费」按钮；不过提示没说试用为什么没开，想试用的人仍得自己推断。
- **失败可以直接重试**：错误就在按钮下面，按钮本身就是重试；只是不说为什么失败，连续失败时用户无从下手。
- **未在真实 Cloud 上验证**：门户、取消和 Creem 的 resume 接口都是替身，真实的 Creem 状态流转（`scheduled_cancel` → `active`）和真实的出错情形没有走过。
