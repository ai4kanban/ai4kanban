# 用命令行按语言和档次生成配音

## Setup

- 本机以 Pro 账号登录 Cloud，本月 AI 积分 5000 未用；另有一个免费账号备用。
- 在任意项目里执行，命令不需要看板。声音名单见 `cli/src/agents/scriptwriter/references/voices.md`。

## Steps

1. 执行 `akb cloud tts --help`。
   预期：列出 `--tier`，standard 是默认档，用于草稿和试听，premium 用于成片；`--out` 说明中文声音写 `.mp3`。
   证据：[01-help.log](01-help.log)
2. 用中文声音、不带 `--tier`，执行 `akb cloud tts --voice Yunzhou --out zh-standard.wav "<中文稿>"`。
   预期：写出 `zh-standard.mp3`，输出 `(Yunzhou, standard)`；约 7 秒的音频扣 19 积分。
   证据：[02-zh-default.log](02-zh-default.log)、[zh-standard.mp3](zh-standard.mp3)
3. 同一稿子加 `--tier premium`。
   预期：写出 `.mp3`，输出 `(Yunzhou, premium)`；约 5 秒的音频扣 24 积分，每秒比标准档贵。
   证据：[03-zh-premium.log](03-zh-premium.log)、[zh-premium.mp3](zh-premium.mp3)
4. 用英文声音 `Arthur` 读英文稿，不带 `--tier`。
   预期：写出 `.wav`，输出 `(Arthur, standard)`；约 5 秒扣 13 积分。
   证据：[04-en-standard.log](04-en-standard.log)、[en-standard.wav](en-standard.wav)
5. 同一稿子加 `--tier premium`。
   预期：输出 `(Arthur, premium)`；约 6 秒扣 25 积分。
   证据：[05-en-premium.log](05-en-premium.log)、[en-premium.wav](en-premium.wav)
6. 用多语种声音 `Kore` 读中文稿。
   预期：旧声音照常可用，写出 `.wav`，输出 `(Kore, standard)`。
   证据：[06-multilingual.log](06-multilingual.log)、[multi-zh.wav](multi-zh.wav)
7. 用中文声音读英文稿，再用英文声音读中文稿。
   预期：分别报 `This text is in English. Pick an English voice.` 和
   `This text is in Chinese. Pick a Chinese voice.`，带用法，退出码 2；不写文件、不扣积分。
   证据：[07-wrong-language.log](07-wrong-language.log)
8. 加 `--tier best`。
   预期：报 `--tier best: pick one of standard, premium.` 并给出用法，退出码 2；不写文件、不扣积分。
   证据：[08-unknown-tier.log](08-unknown-tier.log)
9. 换免费账号，执行第 2 步的命令。
   预期：中英文提示这是 Pro 功能并给出升级地址，建议改用本地声音，退出码 1。
   证据：[09-free-account.log](09-free-account.log)

## Feedback

- **选档顺手**：一个参数，默认是便宜的档，输出里写明声音和档次。
- **语言不符说得清楚**：报错直接告诉用户该换哪种声音，不写文件也不扣积分，但不会列出可选的声音名。
- **声音名难找**：命令没有列出声音的方式，用户只能查智能体的参考文件。
- **文件名被改**：`--out zh.wav` 实际写成 `zh.mp3`，帮助里有说明，输出也写了真实文件名，但用法行仍是 `<file.wav>`，脚本若按原名读取会找不到。
- **看不到花费**：命令不说扣了多少积分、还剩多少，只能去账单页看。
- **证据来源**：在本地云端栈上取证（真实 OpenRouter 配音，Pro 来自本地种入的赠送），不是线上 Cloud。
