# 用命令行按档次生成图片

## Setup

- 本机以 Pro 账号登录 Cloud，本月 AI 积分 5000 未用；另有一个免费账号备用。
- 在任意项目里执行，命令不需要看板。

## Steps

1. 执行 `akb cloud image --help`。
   预期：列出 `--tier`，说明可选 economy、standard（默认）、premium，档次越高积分越多。
   证据：[01-help.log](01-help.log)
2. 不带 `--tier`，执行 `akb cloud image --aspect 16:9 --out crane-standard.png "<提示词>"`。
   预期：写出图片，输出注明模型和 `standard`；本月积分少 320。
   证据：[02-default-standard.log](02-default-standard.log)、[crane-standard.png](crane-standard.png)
3. 同一提示词加 `--tier economy`。
   预期：输出注明 `economy`；积分少 230。
   证据：[03-economy.log](03-economy.log)、[crane-economy.png](crane-economy.png)
4. 同一提示词加 `--tier premium`。
   预期：输出注明 `premium`；积分少 769。
   证据：[04-premium.log](04-premium.log)、[crane-premium.png](crane-premium.png)
5. 加 `--tier best`。
   预期：报 `--tier best: pick one of economy, standard, premium.` 并给出用法，退出码 2；
   不写文件、不扣积分。
   证据：[05-unknown-tier.log](05-unknown-tier.log)
6. 换免费账号，执行第 3 步的命令。
   预期：中英文提示这是 Pro 功能并给出升级地址，建议改用现有图片或截图，退出码 1。
   证据：[06-free-account.log](06-free-account.log)

## Feedback

- **选档顺手**：一个参数、默认值不变，输出里直接写出所用档次，出错时提示合法取值，不扣积分。
- **看不到花费**：命令不说这张图扣了多少积分、还剩多少，只能去网页账单页看。
- **经济档不够省**：经济档只比标准档少约 30% 积分（230 对 320），这次实测的上游成本却不到标准档的一半；三张图肉眼差别不大，用户难以判断高质档值不值 769。
- **证据来源**：在本地云端栈上取证（真实 OpenRouter 生图，Pro 来自本地种入的赠送），不是线上 Cloud。
