# 在命令行生成一张图和一段托管配乐

## Setup

- **账号**：已登录 Cloud，先是免费版，第 3 步起是 Pro。Cloud 是本地替身 [stand-in.mjs](stand-in.mjs)（`PORT=… node stand-in.mjs`），答 `/v1/billing`、`/v1/image`、`/v1/music`，`GET /_set?pro=1` 切成 Pro，`fail=1` 让生成接口回 502；`AI4KANBAN_CLOUD_URL` 指向它。
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

4. 让 Cloud 的生成接口出错，再各执行一次。
   都退出码 1：「图像暂时无法生成，请稍后重试。」/「托管配乐暂时无法生成，请稍后重试。」，后面各跟上面那句退路；没有写出新文件。
   [04-failed.log](04-failed.log)

5. 执行 `akb cloud music --out out/x.wav "…"`（漏了秒数），再用 `--seconds abc`。
   退出码 2：「Missing --seconds.」和「--seconds abc: give a number of seconds.」，各附一行正确用法。
   [05-usage.log](05-usage.log)

## Feedback

- **说法跟能力走**：图像命令的提示不再写「生成封面」，退路「改用现有图片或截图」对任何用途都说得通；配乐的退路「留空音乐槽位」直接告诉做视频的 agent 该怎么办。
- **两条命令一个样**：Pro 拒绝、失败、退路都是同一套中英两句，agent 读一种就会读另一种。
- **用法行写 `.mp3`**：`music` 的用法提示是 `--out <file.mp3>`，可 Cloud 给的是 WAV（卡片也说只有 WAV 才截断淡出）；照着写 `.mp3` 会得到扩展名不符的文件。
- **图像那行露出模型位**：替身没回 `x-model`，图像命令就打出 `(unknown model)`；配乐只报秒数，两边风格不一致。
- **Cloud 是假的**：鉴权、Pro 判断、积分扣除、真实托管配乐的音质和时长截断都没有跑到；这里只验证命令行一侧的参数、文案和落盘。
