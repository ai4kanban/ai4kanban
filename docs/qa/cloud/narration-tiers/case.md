# 按语言和档次生成配音

## Setup

- Pro 账号，本月 5000 AI 积分未用。
- 用本地云端栈取证（见 `docs/qa/README.md`「如何运行取证」的 web 一条），Worker 带真实的 OpenRouter key，
  配音是真调用；积分用 `GET /v1/billing` 看。

## Steps

1. `GET /v1/billing`，再用中文声音 `Yunzhou` 读一句中英混排的稿子（`POST /v1/speech`，`tier: "standard"`）。
   预期：`rates.speech` 是 160 / 270；200，返回 mp3，`x-tier: standard`；4.4 秒扣 12 积分。
   证据：[01-zh-standard.log](01-zh-standard.log)、[01-zh-standard.mp3](01-zh-standard.mp3)
2. 同一句，`tier: "premium"`。
   预期：`x-tier: premium`，同一个声音；5.0 秒扣 23 积分。
   证据：[02-zh-premium.log](02-zh-premium.log)、[02-zh-premium.mp3](02-zh-premium.mp3)
3. 英文声音 `Arthur` 读英文稿，标准档。
   预期：返回 wav，`x-tier: standard`；4.6 秒扣 13 积分。
   证据：[03-en-standard.log](03-en-standard.log)、[03-en-standard.wav](03-en-standard.wav)
4. 同一句，高质档。
   预期：`x-tier: premium`；4.6 秒扣 20 积分。
   证据：[04-en-premium.log](04-en-premium.log)、[04-en-premium.wav](04-en-premium.wav)
5. 旧的多语种声音 `Kore` 读中文，不带 `tier`。
   预期：照常可用，按标准档，`x-tier: standard`。
   证据：[05-default-tier.log](05-default-tier.log)、[05-default-tier.wav](05-default-tier.wav)
6. 英文声音读中文稿、中文声音读英文稿、`tier: "best"`。
   预期：都是 400 `bad_request`，分别提示换中文声音、换英文声音、列出两个档次；积分不变。
   证据：[06-refused.log](06-refused.log)
7. 查 `cloud.ai_calls`，并用 `afinfo` 看每个音频的时长。
   预期：每次调用一行，带档次、秒数和上游成本；音频都能解析，时长与扣分对得上。
   证据：[07-ai-calls.log](07-ai-calls.log)、[08-duration.log](08-duration.log)

## Feedback

同一个声音两档都能用，试听后换高质档不会变声；中文声音读混排稿也没被拒，只有整段语言不符才报错，
提示还告诉你该换什么。摩擦点：高质档比标准档贵近七成，这句短稿听不出多少差别；中文返回 mp3、其他返回
wav，调用方要看 `content-type` 决定扩展名；只有 `standard` / `premium` 的说明，没有接口列出声音，选声音
要靠文档。命令行 `akb cloud tts --tier` 属于 skill 模块，账单页的单价行属于 web 模块，定价页的单价见
[查看价格并选择方案](../view-pricing/case.md)。线上没有可用的 Pro 账号，配音来自本地栈。
