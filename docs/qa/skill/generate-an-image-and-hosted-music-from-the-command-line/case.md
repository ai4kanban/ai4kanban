# 在命令行生成一张图和一段托管配乐

## Setup

- **账号**：已登录 Cloud，先是免费版，第 3 步起是 Pro。Cloud 是本地替身 [stand-in.mjs](stand-in.mjs)（`PORT=… node stand-in.mjs`），答 `/v1/billing`、`/v1/image`、`/v1/music`，`GET /_set?pro=1` 切成 Pro，`trial=1` / `month=1` 让生成接口回 429 `credits_used_up`（试用积分用完不带 `retry-after`，当月积分用完带），`fail=1` 让生成接口回 502；`AI4KANBAN_CLOUD_URL` 指向它。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME` 和 `AI4KANBAN_HOME`（见 [r.sh](r.sh)），在一个空文件夹里执行；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb cloud --help`。
   列出 `image`「generate an image through Cloud, spending Pro credits」、`tts` 和 `music`「generate an instrumental track through Cloud, spending Pro credits」。
   [01-help.log](01-help.log)

2. 免费账号下执行 `akb cloud image --aspect 16:9 --out cover.png "…"`，再执行 `akb cloud music --seconds 8 --out music.wav "…"`。
   都退出码 1，不写文件。图：「图像生成是 Pro 功能」加「也可以改用现有图片或截图。」，不再提封面；配乐：「托管配乐是 Pro 功能」加「也可以先留空音乐槽位，或换成你自己的曲子。」；都中英各一句，带升级链接。
   [02-free-refused.log](02-free-refused.log)

3. 升到 Pro，再各执行一次（`--out out/…`，配乐 4 秒）。
   回 `out/cover.png (…)` 和 `out/music.wav (4s)`，文件夹自动建出；两份文件分别是 PNG 和 WAV。配乐那行不出现厂商或模型名。
   [03-pro.log](03-pro.log)

4. 让 Cloud 说试用期的积分用完了，再各执行一次；再换成当月积分用完，执行一次图像。
   试用积分用完：都退出码 1，不写文件，「试用期的 AI 积分已用完。试用结束后可在桌面应用的 Billing 页购买 Pro。」中英各一句，后面跟各自的退路；不提重置时间。当月积分用完仍是「本月积分已用完，下月 1 日（UTC）重置……」。
   [04-trial-credits-used-up.log](04-trial-credits-used-up.log)

5. 让 Cloud 的生成接口出错，再各执行一次。
   都退出码 1：「图像暂时无法生成，请稍后重试。」/「托管配乐暂时无法生成，请稍后重试。」，后面各跟上面那句退路；没有写出新文件。
   [05-failed.log](05-failed.log)

6. 执行 `akb cloud music --out out/x.wav "…"`（漏了秒数），再用 `--seconds abc`。
   退出码 2：「Missing --seconds.」和「--seconds abc: give a number of seconds.」，各附一行正确用法。
   [06-usage.log](06-usage.log)

## Feedback

- **说法跟能力走**：图像的退路「改用现有图片或截图」对任何用途都说得通；配乐的退路「留空音乐槽位」直接告诉做视频的 agent 该怎么办。
- **试用和当月分得清**：试用积分用完不再说「下月 1 日重置」——试用积分本来就不会重置——而是指向试用结束后去 Billing 购买；两种情况退路相同，agent 不用区分。
- **两条命令一个样**：Pro 拒绝、积分用完、失败、退路都是同一套中英两句，agent 读一种就会读另一种。
- **试用中的人读到「Pro 功能」会困惑**：试用期内账号就是 Pro，这条路不会遇到；但试用结束后再被拒，提示仍是「升级 Pro」的链接，而不是「去 Billing 购买」，和试用积分用完那句指向不同的地方。
- **用法行写 `.mp3`**：`music` 的用法提示是 `--out <file.mp3>`，可 Cloud 给的是 WAV；照着写 `.mp3` 会得到扩展名不符的文件。
- **图像那行露出模型位**：替身没回 `x-model`，图像命令就打出 `(unknown model)`；配乐只报秒数，两边风格不一致。
- **Cloud 是假的**：鉴权、Pro 和试用判断、积分扣除、真实托管配乐的音质和时长截断都没有跑到；这里只验证命令行一侧的参数、文案和落盘。
