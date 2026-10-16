# 在命令行按标签找模板、看预览，再取回一个

## Setup

- **账号**：已登录 Cloud，免费版。模板库是本地假 Cloud，按 `cloud/endpoints.md` 的 `/v1/templates` 应答：`ui` 类别有三个模板——`hero-tilted-screen`（免费，标签 hero、saas，外部复刻）、`hero-gradient-glow`（Pro，hero、launch）、`pricing-three-tier`（免费，pricing、saas），各带一张预览图；`video` 类别是空的。
- **终端**：zsh，`env -i` 只留 `PATH`、`HOME` 和 `AI4KANBAN_HOME`，在一个空文件夹里执行；日志里的 `akb` 就是这次构建出的命令。

## Steps

1. 执行 `akb cloud template list-tags --category ui`，再换成 `--category video`。
   `ui` 列出 `hero (2)`、`saas (2)`、`launch (1)`、`pricing (1)`；`video` 回中英两句「这个类别还没有模板。可以不用模板继续。」，退出码 0。
   [01-tags.log](01-tags.log)

2. 执行 `akb cloud template search --category ui --tags hero landing page`。
   列出两个 hero 模板，各一行「名字 — 标题 [free/pro]」，下面是一句摘要、标签和预览文件名、说明；没有 pricing 那个。
   [02-search.log](02-search.log)

3. 执行 `akb cloud template preview hero-tilted-screen --to previews`，再对 `hero-gradient-glow` 做一次。
   各写出一张 `previews/<模板名>-preview.png`；Pro 模板免费账号也能看预览。
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
   列出原站、参考网址、带时区的采集时间和凭证说明。
   [07-source.log](07-source.log)

8. 换一个没登录的 `AI4KANBAN_HOME`，执行 `akb cloud template list-tags --category ui`。
   退出码 1：未登录，请在应用的「配置 → Cloud」登录，再加一句「可以不用模板继续」。
   [08-signed-out.log](08-signed-out.log)

9. 去掉假 Cloud，对着线上 `api.ai4kanban.dev` 执行 `akb cloud template list-tags --category ui`。
   应当列出标签，或在服务没有模板库时说「模板库暂时无法使用」。实际回的是「模板库里没有这个模板。」——线上服务还没有 `/v1/templates`，命令把这个 404 说成了模板不存在，已报待筛选。
   [09-live.log](09-live.log)

## Feedback

- **一步一步收得很紧**：先标签、再搜、再看图、最后才下载，每步输出都短，适合 agent 读了转述。
- **拒绝都留了退路**：要 Pro、没登录、文件已存在，都是中英两句加「可以不用模板继续」，不会把 agent 卡死。
- **不覆盖本地改动**：第二次取回整个拒掉、一个文件都不写，自己改过的文件很安全；但没有 `--force`，想重新取只能换文件夹。
- **线上还用不了**：服务端没部署时报「没有这个模板」，用户和 agent 都会以为是名字写错了。
- **模板库是假的**：数据和应答都来自本地替身，验证的是命令行这一侧；真实 Cloud 的鉴权、Pro 判断和 R2 文件没有跑到，界面设计师、视频编辑真的去挑模板、问用户选哪个也没有跑到。
