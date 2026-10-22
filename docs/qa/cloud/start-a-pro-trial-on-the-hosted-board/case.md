# 在 Cloud 看板网站开始 7 天 Pro 试用，试用中不能购买，已试用过的不能再开

## Setup

- **账号**：已在 Cloud 看板网站登录（见 [登录](../sign-in-to-the-hosted-board/case.md)）。第 1–4 步用从没有过 Pro 的账号，第 5–7 步用 7 天试用昨天刚结束的账号。
- **本次证据的来源**：没碰线上 Cloud，也没花钱。[pg.sh](pg.sh) 起临时 PostgreSQL、应用全部迁移（含 `0046_pro_trials.sql`）并写入这两个账号；[server.mjs](server.mjs) 在 `127.0.0.1:8796` 跑真实 Worker 代码，Supabase 的密钥和 RPC、Creem 的 API 和结账页是替身，试用记录真的写进这个库。网站（`cloud-ui`）用 `next dev -p 3796` 实跑并指向它；登录由 [session.mjs](session.mjs) 直接写入登录 Cookie，跳过 GitHub。[run.mjs](run.mjs) 用无头 Chrome（界面语言中文）跑下面各步，每步日志里附 Worker 的请求记录。

## Steps

1. 点头像 → 「设置」。
   套餐显示「免费版」，下面只有一个「免费试用 7 天」，没有价格和「购买 Pro」。
   [01-untried.log](01-untried.log)
   ![](01-untried.png)

2. 打开旧的购买链接 `/billing/checkout?period=yearly`。
   回到设置页，仍是「免费试用 7 天」，不会走结账。
   [02-checkout-refused.log](02-checkout-refused.log)

3. 按「免费试用 7 天」。
   留在设置页，套餐变成「Pro」加「试用中」标签，下面一行「还剩 7 天 · 2026年10月29日结束」，没有购买按钮；账号得到 1000 AI 积分，不写重置时间。
   [03-trialing.log](03-trialing.log)
   ![](03-trialing.png)

4. 试用中再打开 `/billing/checkout?period=monthly`，再打开定价页「免费试用 7 天」指向的 `/billing/trial`。
   两次都回到设置页，套餐不变；第二次 Cloud 以「已用过 Pro」拒绝，没有多出一条试用；面板已写着「试用中」，不另加提示。
   [04-no-purchase-or-second-trial.log](04-no-purchase-or-second-trial.log)

5. 换试用已结束的账号，打开设置页。
   套餐显示「免费版」、按月 $15 / 按年 $120 和「购买 Pro」，没有试用按钮。
   ![](05-trial-over.png)

6. 打开定价页「免费试用 7 天」指向的 `/billing/trial`。
   Cloud 拒绝，回到设置页，套餐上方多一条灰底提示「你已用过免费试用，升级到 Pro 即可继续使用。」，下面照旧是购买表单。
   [05-trial-over.log](05-trial-over.log)
   ![](05-trial-used.png)

7. 保持「按年」，按「购买 Pro」。
   浏览器被送到 Creem 的结账页。
   [06-buy.log](06-buy.log)

## Feedback

- **入口只有一个**：没试用过的人只看到「免费试用 7 天」，不用先比较价格；按一下就开始，不要绑卡。
- **试用状态一眼可见**：「试用中」标签和「还剩 7 天」加结束日期放在一起，什么时候能买不用猜。
- **试用中看不到能用多少积分**：设置页不显示 1000 积分和余额，只有接口里有；用完了才在命令行里知道。
- **试用用过了会说**：试用结束的人从定价页再点「免费试用 7 天」，回来先看到「你已用过免费试用」，紧挨着就是价格和「购买 Pro」，下一步很清楚；提示是灰底，不像报错。
- **试用中重复点仍无声**：试用中的人再点只是回到设置页，地址里留着 `?trial=failed`；面板本身写着「试用中」，问题不大，但没说这次按钮为什么没反应。
- **试用中想提前买没有出路**：想马上付费的人在网站上找不到任何购买入口，也没有一句话说明要等试用结束。
- **未在真实 Cloud 上验证**：登录、Creem 和 Supabase 都是替身；真实 GitHub 登录后从定价页直接开始试用、真实结账没有走过。
