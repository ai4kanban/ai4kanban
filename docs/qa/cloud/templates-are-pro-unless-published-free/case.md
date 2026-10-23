# 模板默认是 Pro：免费账号只能取到维护者明确发布为免费的模板

## Setup

- **账号**：普通免费账号 `lin` 已在 WildCrane 登录，没有 Pro；维护者 `neverchanje` 发布模板。
- **模板库**：#1931 之前，维护者已发布图文模板 `long-read`，它的 `template.md` 写着 `access: free`。之后再发布的三个都来自仓库 `templates/carousel/`：`warm-explainer` 去掉了 `access` 一行，`tutorial-steps` 保留 `access: free`，`gratis-steps` 改成 `access: gratis`。
- **本次证据的来源**：没碰线上 Cloud。[pg.sh](pg.sh) `0044` 起一个临时 PostgreSQL，只应用到 0044，即 #1931 之前的库；[migrate.sh](migrate.sh) 再单独应用 0045，模拟 Cloud 部署（同一次部署还带上 0046 的 Pro 试用，本版 Worker 查 Pro 时要用到）。[server.mjs](server.mjs) 在 `127.0.0.1:8811` 上跑本交付的 Worker 代码，Supabase 的 JWKS 由它顶替、RPC 在这个库里真的执行，R2 换成内存桶，并为两个账号写好登录态；[akb.sh](akb.sh) 用干净环境跑本交付构建的 `akb`；[pro-run.sh](pro-run.sh) 跑下面每一步。发布 `long-read` 的过程和 Worker 日志见 [00-setup.log](00-setup.log)。

## Steps

1. `lin` 运行 `akb cloud template search --category carousel --tags bilingual`，再 `akb cloud template get long-read --to mine/`。
   搜索结果是 `long-read — Long-read carousel [free]`；取回提示「已取回 long-read：10 个文件，位于 mine/」。
   [01-free-before.log](01-free-before.log)

2. Cloud 部署，应用迁移 `0045_templates_pro.sql`；`lin` 再搜索一次，再 `get long-read --to again/`，然后 `preview long-read --to look/`，最后看一眼之前的 `mine/`。
   搜索结果变成 `[pro]`；`get` 被拒、退出码 1：「这个模板需要 Pro。升级 Pro：https://wildcrane.ai/pricing」「可以不用模板继续。」，`again/` 没被创建；`preview` 照常写出 `look/long-read-cover.png`；`mine/` 里之前取回的文件都还在。
   [02-switched-to-pro.log](02-switched-to-pro.log)
   ![](02-preview.png)

3. 维护者发布没写 `access` 的 `warm-explainer`；`lin` 搜索，再 `get warm-explainer --to warm/`。
   发布提示「已发布 warm-explainer：10 个文件。」，没有任何关于访问级别的提示；搜索里它是 `[pro]`，`get` 同样被拒并给出升级链接。
   [03-publish-default.log](03-publish-default.log)

4. 维护者发布写明 `access: free` 的 `tutorial-steps`；`lin` 搜索，再 `get tutorial-steps --to steps/`。
   搜索里它是 `[free]`，另两个是 `[pro]`；取回提示「已取回 tutorial-steps：10 个文件，位于 steps/」。
   [04-publish-free.log](04-publish-free.log)

5. 维护者发布 `access: gratis` 的 `gratis-steps`；`lin` 再搜索。
   在本地就被拒、退出码 1：「模板未通过校验：access 只能是 free 或 pro。」；搜索结果里没有它。
   [05-publish-bad-access.log](05-publish-bad-access.log)

## Feedback

- **转换对免费用户是突然的**：昨天还 `[free]` 的模板，今天 `get` 就要 Pro；命令里没有任何「它从免费变成了 Pro」的说明，只能从标记变化里自己发现。
- **已取回的不受影响**：本地文件照常在，`preview` 仍能看到效果，先看再决定是否升级；升级链接已是 `wildcrane.ai/pricing`，和新名字一致。
- **免费用户几乎无模板可取**：迁移把现有模板全部转 Pro；搜索结果里 `[pro]` 只是行尾一个小标记，搜索本身不能只看免费的。
- **默认值不出声**：维护者没写 `access` 时发布成功但不说「按 Pro 发布」，漏写一行就悄悄变 Pro；写错值则在本地就被拦下，提示清楚。
- **未在真实 Cloud 上验证**：迁移跑在临时 PostgreSQL 上，Supabase 和 R2 是替身；线上的真实 Pro 订阅、官网模板库上的「Pro」标签（属 site 模块）没有在这里走过。
