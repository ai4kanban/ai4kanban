# 发布一个不写 access 和 source 的模板，按 Pro、原创收进模板库

## Setup

- **模板**：`promo-carousel-steps/` 里一份 `template.md` 和一个页面文件；frontmatter 只有 `name`、`category: carousel`、`tags`、`title`、`summary`、`description`，不写 `access` 和 `source`。图文模板设计做出的模板就是这样交付的。
- **账号**：维护者 `neverchanje` 发布，普通免费账号 `lin` 查看和取回。
- **本次证据的来源**：没碰线上 Cloud。[server.mjs](server.mjs) 在 `127.0.0.1:8847` 上跑工作树里真实的 Worker 代码，Supabase 的 JWKS 和 RPC 由它在内存里顶替，R2 换成内存桶，并为两个账号写好登录态；[akb.sh](akb.sh) 用干净环境跑这次构建出的 `akb`。Worker 日志见 [00-setup.log](00-setup.log)。

## Steps

1. 看模板的 frontmatter。
   没有 `access`，也没有 `source`（`grep` 退出码 1）。
   [01-template.log](01-template.log)

2. 维护者执行 `akb cloud template publish promo-carousel-steps`。
   不要求补字段：「已发布 promo-carousel-steps：2 个文件。」，退出码 0。
   [02-publish.log](02-publish.log)

3. 免费账号执行 `akb cloud template search --category carousel --tags steps`，再 `akb cloud template source promo-carousel-steps`。
   搜索结果标着 `[pro]`；来源答「原创模板，没有外部参考。」
   [03-catalog.log](03-catalog.log)

4. 免费账号执行 `akb cloud template get promo-carousel-steps --to promo`。
   被拒，退出码 1：「这个模板需要 Pro。升级 Pro：https://ai4kanban.dev/pricing」「可以不用模板继续。」；没有建 `promo/`。
   [04-get.log](04-get.log)

5. 另一份模板写明 `access: free` 后发布，免费账号再搜索、取回它。
   搜索里它标 `[free]`，旁边的 `promo-carousel-steps` 仍是 `[pro]`；取回 2 个文件。
   [05-explicit-free.log](05-explicit-free.log)

6. 换两份模板，分别写 `source: [a]` 和 `access: paid` 发布。
   都被拒，退出码 1：「source 写法不对；原创模板可以不写，或写 source: { original: true }。」和「access 只能是 free 或 pro。」——省略照默认，写错仍拦下。
   [06-malformed.log](06-malformed.log)

## Feedback

- **默认收费，免费要明说**：不写 `access` 就是 Pro，想放出免费模板得记得写 `access: free`；搜索结果里的 `[pro]`/`[free]` 一眼能分清。
- **被拒时给了出路**：免费账号取 Pro 模板，提示同时给升级链接和「可以不用模板继续」，不会卡住正在跑的工作。
- **原创全凭自觉**：不写 `source` 就被当成原创；复刻参考帖做出的模板如果漏写来源，会以原创身份上架。
- **没有跑到的**：线上 Cloud 和真实 Supabase 数据库，包括把已发布模板全部改成 Pro 的迁移 `0045_templates_pro.sql`；Pro 账号取回 Pro 模板。
