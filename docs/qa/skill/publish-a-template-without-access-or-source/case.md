# 发布一个不写 access 和 source 的模板，按免费、原创收进模板库

## Setup

- **模板**：`promo-carousel-steps/` 里一份 `template.md` 和一个页面文件；frontmatter 只有 `name`、`category: carousel`、`tags`、`title`、`summary`、`description`，不写 `access` 和 `source`。图文模板设计做出的模板就是这样交付的。
- **账号**：维护者 `neverchanje` 发布，普通免费账号 `lin` 查看和取回。
- **本次证据的来源**：没碰线上 Cloud。[server.mjs](server.mjs) 在 `127.0.0.1:8842` 上跑工作树里真实的 Worker 代码，Supabase 的 JWKS 和 RPC 由它在内存里顶替，R2 换成内存桶，并为两个账号写好登录态；[akb.sh](akb.sh) 用干净环境跑这次构建出的 `akb`。Worker 日志见 [00-setup.log](00-setup.log)。

## Steps

1. 看模板的 frontmatter。
   没有 `access`，也没有 `source`（`grep` 退出码 1）。
   [01-template.log](01-template.log)

2. 维护者执行 `akb cloud template publish promo-carousel-steps`。
   不再要求补字段：「已发布 promo-carousel-steps：2 个文件。」，退出码 0。
   [02-publish.log](02-publish.log)

3. 免费账号执行 `akb cloud template search --category carousel --tags steps`，再 `akb cloud template source promo-carousel-steps`。
   搜索结果标着 `[free]`；来源答「原创模板，没有外部参考。」
   [03-catalog.log](03-catalog.log)

4. 免费账号执行 `akb cloud template get promo-carousel-steps --to promo`。
   取回 2 个文件，没有要求 Pro。
   [04-get.log](04-get.log)

5. 换一份模板，先写 `source: [a]` 发布，再改成 `access: paid` 发布。
   都被拒，退出码 1：「source 写法不对；原创模板可以不写，或写 source: { original: true }。」和「access 只能是 free 或 pro。」——省略照默认，写错仍拦下。
   [05-malformed.log](05-malformed.log)

## Feedback

- **少两个必填项**：原创免费模板不用再写 `access: free` 和 `source: { original: true }` 这两行样板，图文模板设计交来的文件直接能发。
- **错误提示会教**：`source` 写错时提示顺带说明原创可以不写，改起来不用查文档。
- **原创全凭自觉**：不写 `source` 就被当成原创，模板库里看不出发布者是没想过来源还是确实原创；复刻参考帖做出的模板如果漏写来源，会以原创身份上架。
- **没有跑到的**：线上 Cloud 和真实 Supabase 数据库；图文模板设计 Agent 本身——它的说明（每页职责、三类页面、图片比例）放在看板自己的 `AGENT.md` 里，不在本仓库的命令里，这里只证明发布这一环。
