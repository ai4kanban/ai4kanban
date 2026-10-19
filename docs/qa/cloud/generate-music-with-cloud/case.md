# 用 `akb cloud music` 生成一段托管配乐

## Setup

- **账号**：本机已在 AI4Kanban 登录；第 1 步用免费账号，其余用 Pro 账号。视频克隆 Agent 给模板配乐时跑的也是这条命令，这里由人直接跑。
- **本次证据的来源**：没碰线上 Cloud，也没花钱。[pg.sh](pg.sh) 起临时 PostgreSQL、应用全部迁移并写入一个 Pro 订阅；[upstream.sh](upstream.sh) 做出替身上游要回的 30 秒 MP3；[server.mjs](server.mjs) 在 `127.0.0.1:8795` 跑真实 Worker 代码，Supabase 和上游都是替身，扣费与调用记录真的写进这个库；[mint.mjs](mint.mjs) 写登录态，[akb.sh](akb.sh) 用干净环境跑本工作区构建的 `akb`，[run.sh](run.sh) 跑下面各步。Worker 日志见 [00-worker.log](00-worker.log)。

## Steps

1. 用免费账号运行 `akb cloud music --seconds 10 --out cowork.mp3 "warm lo-fi, 74 BPM, soft keys"`。
   被拒：「托管配乐是 Pro 功能。升级 Pro：https://ai4kanban.dev/pricing」，附「也可以先留空音乐槽位，或换成你自己的曲子。」，中英文各一遍；没有写出文件。
   [01-free.log](01-free.log)

2. 换 Pro 账号运行同一条命令。
   输出 `cowork.mp3 (10s)`；上游回了 30 秒，文件被截成 10 秒的 MP3，最后 1.5 秒逐渐变弱到接近无声。账号新增一笔 `music` 扣费，160 积分，调用记录 `ok`。
   [02-generate.log](02-generate.log)
   ![](02-waveform.png)

3. 运行 `--seconds 3`，再用超过 4000 字的提示词运行。
   分别提示「Give the length in seconds, from 5 to 180.」和「That prompt is too long. Keep it to 4000 characters or fewer.」，附用法；都没写文件，输出不含厂商或模型名。
   [03-bad-input.log](03-bad-input.log)

4. 上游出错时再运行一次。
   提示「托管配乐暂时无法生成，请稍后重试。」和同一条备用办法；没写文件，不扣积分，调用记录为失败。
   [04-upstream-down.log](04-upstream-down.log)

## Feedback

- **一条命令拿到能直接用的曲子**：给秒数就得到对应长度、结尾自然淡出的 MP3，不用自己剪。
- **失败都有退路**：非 Pro 和上游出错都附「留空音乐槽位或换成自己的曲子」，Agent 照抄给用户也看得懂；失败不扣积分。
- **参数报错只有英文**：Pro 提示和失败提示是中英双语，但秒数越界、提示词太长只回一句英文，和其他提示不一致。
- **用法行写着长路径**：在本仓库外用 `akb` 跑时应显示 `akb …`；这里用法行显示的是 `node …/ai4kanban.mjs`，是本次用替身命令跑的结果，不代表正式安装。
- **价格要自己去找**：命令成功只说 `(10s)`，不说扣了 160 积分，也不说还剩多少；想知道得去 Billing 页。
- **未在真实 Cloud 上验证**：上游是替身，真实托管配乐的音质、时长偏差、中国大陆访问和线上扣费都没走过。
