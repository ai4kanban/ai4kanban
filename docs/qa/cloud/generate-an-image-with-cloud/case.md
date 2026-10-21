# 用 `akb cloud image` 生成一张图像

## Setup

- **账号**：本机已在 AI4Kanban 登录；第 1 步用免费账号，第 4 步用正在试用 Pro、试用积分已用完的账号，其余用 Pro 账号。
- **本次证据的来源**：没碰线上 Cloud，也没花钱。沿用 [托管配乐用例](../generate-music-with-cloud/case.md) 的临时 PostgreSQL、真实 Worker 和替身上游（替身回一张 1024×576 的纯色 PNG），[run.sh](run.sh) 跑下面各步。Worker 日志见 [00-worker.log](00-worker.log)。

## Steps

1. 用免费账号运行 `akb cloud image --aspect 16:9 --out cover.png "a calm kanban board at dusk"`。
   被拒：「图像生成是 Pro 功能。升级 Pro：https://ai4kanban.dev/pricing」，附「也可以改用现有图片或截图。」，中英文各一遍；没有写出文件。
   [01-free.log](01-free.log)

2. 换 Pro 账号运行同一条命令。
   写出 `cover.png`（1024×576 PNG），输出在文件名后的括号里写着所用模型；账号新增一笔 `image` 扣费，320 积分。
   [02-generate.log](02-generate.log)

3. 上游出错时再运行一次。
   提示「图像暂时无法生成，请稍后重试。」和同一条备用办法；没写文件，不扣积分。
   [03-upstream-down.log](03-upstream-down.log)

4. 换试用积分已用完的账号运行一次。
   被拒：「试用期的 AI 积分已用完。试用结束后可在桌面应用的 Billing 页购买 Pro。」和同一条备用办法，中英文各一遍；不提重置时间，没写文件，不扣积分。
   [04-trial-used-up.log](04-trial-used-up.log)

## Feedback

- **说法通用了**：提示不再写「封面」，拿它做配图、示意图的人不会觉得用错了命令。
- **备用办法实用**：「改用现有图片或截图」对任何用途都成立，Agent 照抄给用户也说得通。
- **试用积分不够出几张图**：1000 积分按每张 320 只够 3 张；用完的提示让人去桌面应用 Billing 页购买，但试用结束前那里买不了，也不说试用还剩几天。
- **成功行露出模型名**：括号里是上游模型的完整 ID；托管配乐刻意不透露厂商和模型，两条命令的做法不一致。
- **价格要自己去找**：成功时不说扣了 320 积分，也不说余额。
- **未在真实 Cloud 上验证**：上游是替身，真实出图质量、参考图和线上扣费都没走过。
