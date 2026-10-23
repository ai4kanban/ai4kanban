# 登录后在模板库按标签找模板，预览后取回

## Setup

- **账号**：已在 WildCrane 登录，免费版，没有 Cloud 邀请。UI 设计和视频 Agent 跑的也是这几条命令，这里由人直接跑。
- **模板库**：维护者已发布两个 `ui` 模板：免费的 `hero-tilted-screen`（#1706 的 hero，带封面预览和 Supahero 截图凭证）和 Pro 的 `hero-centered-glow`。
- **本次证据的来源**：没碰线上 Cloud。[pg.sh](pg.sh) 起一个临时 PostgreSQL 并应用全部迁移；[server.mjs](server.mjs) 在 `127.0.0.1:8793` 上跑真实的 Worker 代码，Supabase 的 JWKS 和 RPC 由它顶替（RPC 在这个库里真的执行），R2 换成内存桶；[mint.mjs](mint.mjs) 写登录态，[akb.sh](akb.sh) 用干净环境跑本工作区构建的 `akb`；[run.sh](run.sh) 以维护者身份发布两个模板（`hero-tilted-screen` 取自主仓库 `templates/ui/`，Pro 模板是脚本现写的两个文件），再跑下面各步。发布过程和 Worker 日志见 [00-setup.log](00-setup.log)。

## Steps

1. 运行 `akb cloud template list-tags --category ui`。
   列出这个类别的标签和模板数：`hero (2)`、`saas (2)`、`dark (1)`、`product-screen (1)`。
   [01-list-tags.log](01-list-tags.log)

2. 运行 `akb cloud template search --category ui --tags hero dark`。
   列出带 `hero` 的两个模板，含主题词 `dark` 的 `hero-tilted-screen` 排第一；每个只有名字、标题、`[free]`/`[pro]`、摘要、标签、预览文件名和描述，没有下载任何文件。换成没人用的标签 `pricing` 时显示「没有匹配的模板。可以不用模板继续。」。
   [02-search.log](02-search.log)

3. 运行 `akb cloud template preview hero-tilted-screen --to assets/`。
   写出 `assets/hero-tilted-screen-cover.png`，就是维护者发布的封面。
   [03-preview.log](03-preview.log)
   ![](03-preview.png)

4. 运行 `akb cloud template get hero-tilted-screen --to site/`。
   提示「已取回 hero-tilted-screen：5 个文件」，`site/` 里的 5 个文件与发布时逐字节相同；预览图和凭证不在其中。
   [04-get.log](04-get.log)

5. 再对 `site/` 运行一次 `get`；再对只有一个自己的 `template.md` 的 `site2/` 运行一次。
   都被拒绝并列出同名文件，建议换文件夹或先移走；`site/hero.tsx` 没变，`site2/` 仍只有原来那个 `template.md`，一个文件都没写。
   [05-get-again.log](05-get-again.log)

6. 运行 `akb cloud template source hero-tilted-screen`，再加 `--to evidence/`。
   显示原站、参考链接、带时区的采集时间和说明凭证来历的 `note`；加 `--to` 后下载 `capture.md` 和 Supahero 截图。
   [06-source.log](06-source.log)
   ![](06-evidence.webp)

7. 对 Pro 模板运行 `akb cloud template get hero-centered-glow --to pro/`，再运行 `preview`。
   `get` 被拒：「这个模板需要 Pro。升级 Pro：https://wildcrane.ai/pricing」「可以不用模板继续。」，`pro/` 没有被创建；`preview` 照常写出预览图。
   [07-pro.log](07-pro.log)

8. 运行 `akb cloud sign-out`，再运行 `list-tags`。
   退出后提示「未登录 WildCrane Cloud。请在 WildCrane 应用的“配置 → Cloud”中登录后重试。」，并说可以不用模板继续。
   [08-signed-out.log](08-signed-out.log)

9. 用这个普通账号运行 `akb cloud template publish`。
   被拒：「只有模板库维护者可以发布或删除模板。」
   [09-publish.log](09-publish.log)

## Feedback

- **先看标签再搜，路线清楚**：标签带数量，搜索结果只给元数据，几行就能判断要不要预览，不会一上来就下载一堆文件。
- **改名后说法一致**：未登录提示里的「WildCrane Cloud」「WildCrane 应用」和 Pro 链接 `wildcrane.ai` 对得上，不再出现旧名字。
- **取回很稳**：文件按哈希校验，有一个同名文件就整份不写，不会把自己的改动盖掉；但它不提供「覆盖」或「只写缺的」，想更新模板只能换文件夹再手工合并。
- **每次失败都给退路**：未登录、Pro、没匹配都附一句「可以不用模板继续」，Agent 照抄给用户也看得懂。
- **Pro 模板能预览不能取**：先看到效果再提示升级，合理；但搜索结果里 `[pro]` 只是行尾一个小标记，免费用户可能挑中了才发现拿不到。
- **预览文件名会重复**：Pro 模板的预览落成 `hero-centered-glow-glow.png`，名字取「模板名-原文件名」，原文件名带模板词时读着别扭。
- **登录只能在应用里**：未登录提示指向「配置 → Cloud」，命令行本身没有登录；只装了命令行的人取不到任何模板。
- **来源记录有用**：`source` 把截图来历、采集时间写清楚；但 `note` 一大段英文排在最前，原站地址反而在后面。
- **未在真实 Cloud 上验证**：R2 是内存桶、Supabase 是替身，Pro 模板是脚本现写的；真实桶的大文件、线上维护者账号和真实 Pro 订阅都没有走过。
