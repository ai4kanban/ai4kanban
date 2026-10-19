# 在命令行按标签找模板、看预览，再取回一个

## Setup

- **账号**：已登录 Cloud，免费版。模板库是本地假 Cloud，按 `cloud/endpoints.md` 的 `/v1/templates` 应答：`ui` 类别有三个模板——`hero-tilted-screen`（免费，标签 hero、saas，外部复刻，预览图名为 `hero-tilted-screen-cover.png`）、`hero-gradient-glow`（Pro，hero、launch，预览图名为 `preview.png`）、`pricing-three-tier`（免费，pricing、saas）；`video` 类别是空的。假 Cloud 是 [stand-in.mjs](stand-in.mjs)（`PORT=… node stand-in.mjs`，`GET /_set?missing=1` 让所有模板库接口回 404），`AI4KANBAN_CLOUD_URL` 指向它。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME` 和 `AI4KANBAN_HOME`（见 [r.sh](r.sh)），在一个空文件夹里执行；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb cloud template list-tags --category ui`，再换成 `--category video`。
   `ui` 列出 `hero (2)`、`saas (2)`、`launch (1)`、`pricing (1)`；`video` 回中英两句「这个类别还没有模板。可以不用模板继续。」，退出码 0。
   [01-tags.log](01-tags.log)

2. 执行 `akb cloud template search --category ui --tags hero landing page`。
   列出两个 hero 模板，各一行「名字 — 标题 [free/pro]」，下面是一句摘要、标签和预览文件名、说明；没有 pricing 那个。
   [02-search.log](02-search.log)

3. 执行 `akb cloud template preview hero-tilted-screen --to previews`，再对 `hero-gradient-glow` 做一次。
   预览名已以模板名开头的照原名存成 `previews/hero-tilted-screen-cover.png`，不再重复成 `hero-tilted-screen-hero-tilted-screen-cover.png`；另一张存成 `previews/hero-gradient-glow-preview.png`。Pro 模板免费账号也能看预览。
   [03-preview.log](03-preview.log)

4. 执行 `akb cloud template get hero-gradient-glow --to hero`。
   退出码 1，中英文说「这个模板需要 Pro」并给升级链接，再加一句「可以不用模板继续」；`hero/` 没有被建出来。
   [04-pro-refused.log](04-pro-refused.log)

5. 执行 `akb cloud template get hero-tilted-screen --to hero`。
   「已取回 hero-tilted-screen：2 个文件，位于 hero」，`hero/` 里是 `index.html` 和 `template.md`。
   [05-get.log](05-get.log)

6. 往 `hero/index.html` 末尾加一行，再执行一次第 5 步的命令。
   退出码 1：「目标文件夹已有同名文件：index.html、template.md。请换一个文件夹，或先移走这些文件。」加的那行还在。
   [06-get-again.log](06-get-again.log)

7. 执行 `akb cloud template source hero-tilted-screen`。
   列出原站、参考网址、带时区的采集时间、说明和凭证文件名。
   [07-source.log](07-source.log)

8. 换一个没登录的 `AI4KANBAN_HOME`，执行 `akb cloud template list-tags --category ui`。
   退出码 1：未登录，请在应用的「配置 → Cloud」登录，再加一句「可以不用模板继续」。
   [08-signed-out.log](08-signed-out.log)

9. 让假 Cloud 的模板库接口都回 404 `not_found`，依次执行 `list-tags --category ui`、`search --category ui --tags hero`、`get hero-tilted-screen --to hero2`。
   `list-tags` 和 `search` 都说「模板库暂时无法使用，请稍后重试。」加「可以不用模板继续。」，不提「没有这个模板」；带名字的 `get` 仍说「模板库里没有这个模板。」。三条退出码都是 1。
   [09-catalog-missing.log](09-catalog-missing.log)

10. 去掉假 Cloud，用一份假的登录凭据对着线上 `api.ai4kanban.dev` 执行 `akb cloud template list-tags --category ui`。
    线上已有 `/v1/templates`（不带凭据直接请求回 `unauthenticated`）；命令说登录已过期、请在「配置 → Cloud」重新登录，加「可以不用模板继续。」，退出码 1。
    [10-live.log](10-live.log)

## Feedback

- **预览名干净了**：已带模板名的预览原样落盘，嵌进卡片的文件名不再出现 `hero-tilted-screen-hero-tilted-screen-…` 这种重复；没带的照旧加前缀，两张图放进同一个文件夹也分得清。
- **一步一步收得很紧**：先标签、再搜、再看图、最后才下载，每步输出都短，适合 agent 读了转述。
- **拒绝都留了退路**：要 Pro、没登录、登录过期、文件已存在、模板库不可用，都是中英两句加「可以不用模板继续」，不会把 agent 卡死。
- **不覆盖本地改动**：第二次取回整个拒掉、一个文件都不写；但没有 `--force`，想重新取只能换文件夹。
- **模板库是假的**：第 1–9 步的数据和应答来自本地替身，验证的是命令行这一侧；真实 Cloud 的鉴权、Pro 判断和 R2 文件没有跑到，第 10 步只证明线上接口已在、假凭据被当成过期；界面设计师、视频编辑真的去挑模板也没有跑到。
