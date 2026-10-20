# 维护者给已发布的模板登记展示资料，官网不登录就能读到目录

## Setup

- **账号**：维护者（GitHub 账号在 `TEMPLATE_PUBLISHERS` 里）已在 AI4Kanban 登录；另有一个普通免费账号 `lin`。官网 `/templates` 读的就是这里的公开目录，这里直接用 `curl` 读它，不带任何登录态。
- **模板库**：维护者已发布三个模板：`ui` 类的 `hero-tilted-screen`（带一张目录预览图）、`video` 类的 `ui-walkthrough-launch`（没有预览图）和 `motion` 类的 `card-widen`（只有一张关键帧预览图）。展示资料是仓库里 `templates/showcase/<模板名>/` 的 `showcase.json` 和它点名的图片、视频；`card-widen` 的片段是线上已登记的 4 秒 `clip.mp4`。
- **本次证据的来源**：没碰线上 Cloud。[server.mjs](server.mjs) 在 `127.0.0.1:8795` 上跑真实的 Worker 代码，Supabase 的 JWKS 和 RPC 由它在内存里顶替，R2 换成支持分段读取的内存桶，并为两个账号写好登录态；[akb.sh](akb.sh) 用干净环境跑主检出的 `akb`；[publish.sh](publish.sh) 发布三个模板，[run.sh](run.sh) 跑下面每一步。发布过程和 Worker 日志见 [00-setup.log](00-setup.log)。

## Steps

1. 不登录，`curl http://127.0.0.1:8795/v1/catalog`。
   返回 200，带 `access-control-allow-origin: *` 和 `cache-control: public, max-age=60`；模板按类别分成 `motion`、`video`、`ui` 三组，每个只有名称、标题、摘要、标签、免费／Pro、封面、时长和片段地址 `clip`。还没登记展示资料时，`hero-tilted-screen` 和 `card-widen` 的封面用各自的预览图，`ui-walkthrough-launch` 的封面是 `null`；三个的时长和 `clip` 都是 `null`。
   [01-catalog-before.log](01-catalog-before.log)

2. 维护者运行 `akb cloud template showcase hero-tilted-screen showcase/hero-tilted-screen`，再对 `ui-walkthrough-launch` 运行一次。
   分别提示「已更新 hero-tilted-screen 的展示资料：2 个文件。」「已更新 ui-walkthrough-launch 的展示资料：3 个文件。」——同一张图被封面和复刻两处点名时只传一次。
   [02-showcase.log](02-showcase.log)

3. 维护者给 motion `card-widen` 登记只有封面和关键帧、没有 `recreation.video` 的展示资料；再换成带 `clip.mp4`、时长 4 的那份。
   第一次被拒、退出码 1：「A motion plays its clip: send recreation.video.」，Worker 答 400，什么都没传；第二次提示「已更新 card-widen 的展示资料：2 个文件。」
   [03-motion-clip.log](03-motion-clip.log)

4. 再读一次 `/v1/catalog`。
   `hero-tilted-screen` 和 `ui-walkthrough-launch` 的封面换成登记的 `recreation.jpg`，视频模板带上时长 `69`，但 `clip` 仍是 `null`：只有 motion 带片段。`card-widen` 的封面换成片段里的 `cover.jpg`，时长 `4`，`clip` 是它的 `clip.mp4` 地址。
   [04-catalog-after.log](04-catalog-after.log)

5. 不登录，`curl http://127.0.0.1:8795/v1/catalog/ui-walkthrough-launch`。
   多出描述、发布时间、来源（原站、参考链接、带时区的采集时间），以及原作与复刻两侧：原作是一张图加 YouTube 视频 id，复刻是一张图加 mp4 地址。不含来源 `note`、文件清单、凭证或发布者。
   [05-detail.log](05-detail.log)

6. 下载详情里的封面；对复刻视频地址和 `card-widen` 目录里的 `clip` 地址各发一次带 `range: bytes=0-1023` 的请求，再整段下载。
   封面与登记的 `recreation.jpg` 逐字节相同；两个视频都答 206，`content-range` 分别是 `bytes 0-1023/13783454` 和 `bytes 0-1023/44067`，整段下载与原 mp4 相同；媒体都标 `immutable`，可永久缓存。
   [06-media.log](06-media.log)
   ![](06-cover.jpg)

7. 维护者用 `--replace` 重新发布 `hero-tilted-screen`。
   提示「已替换 hero-tilted-screen：5 个文件。」，详情里的封面和原作图地址前后不变：展示资料随替换保留。
   [07-replace.log](07-replace.log)

8. 维护者对 `hero-tilted-screen` 只登记一个封面（`{ "cover": "recreation.jpg" }`）。
   提示「1 个文件」；详情的封面换了新地址，原作与复刻都变成 `null`，之前原作图的地址答 404：新登记整份替换旧的。
   [08-reregister.log](08-reregister.log)

9. 用缺 `showcase.json` 的文件夹、坏 JSON、点名了不存在的文件、YouTube 字段填了别的网址、不存在的模板各登记一次；再用普通账号 `lin` 登记。
   每次都被拒、退出码 1：「…中缺少 showcase.json」「showcase.json 不是有效的 JSON」「找不到文件 …」「original.youtube is a YouTube video's URL.」「模板库里没有这个模板」；普通账号是「只有模板库维护者可以发布或删除模板。」
   [09-refused.log](09-refused.log)

10. 不登录，取模板文件、来源记录，用目录的媒体地址取模板文件，对目录发 `POST`，读不存在的模板。
    依次是 401、401（「Sign in to reach this workspace.」）、404「This template has no such file.」、405、404「No template has this name.」：公开目录拿不到源码。
    [10-anonymous.log](10-anonymous.log)

11. 维护者运行 `akb cloud template delete ui-walkthrough-launch`，再读目录、详情和之前的视频地址。
    目录只剩 `ui`、`motion` 两组，详情和视频地址都答 404「No template has this name.」。
    [11-delete.log](11-delete.log)

## Feedback

- **登记一步到位**：一个文件夹、一份 `showcase.json`，命令把点名的文件一起传上去；发布、替换、下架后目录随之变化，不用改官网代码。
- **motion 缺片段挡得住**：只有关键帧的 motion 登记不进去，官网列表拿到的 `clip` 就是能分段播放的 mp4；但拒绝信息是一句英文，前面还套着「模板未通过校验：」，中文用户读到的是半句中文加半句英文，且没说片段该写成什么样（几秒、多大、静音）。
- **已上线的 motion 不受影响**：拒绝只在登记这一步，没片段的旧 motion 照常留在目录里，`clip` 为 `null`；想知道哪些 motion 还缺片段，只能自己读目录逐个看。
- **替换模板不丢展示资料**：重新发布保留封面和对照图；反过来，重新登记是整份覆盖，只想换封面也得把原作、复刻一起写上，否则对照两侧悄悄消失，命令输出里看不出来。
- **公开部分收得紧**：目录和详情只给展示用的字段，源码、凭证、来源说明都要登录；媒体地址带版本、可永久缓存，视频支持分段读取。
- **报错用词不统一**：本地检查的错误都以「模板未通过校验：」开头，但出问题的是展示资料不是模板；服务端拒的字段只有英文；普通账号被拒时说的是「发布或删除模板」，没提登记展示资料。英文提示只传一个文件时是「1 files」。
- **只给维护者用**：普通用户只会经官网看到结果；`showcase.json` 的字段要去 `cloud/endpoints.md` 查，命令帮助里没写。
- **未在真实 Cloud 上验证**：数据库、R2 和 Supabase 都是内存替身；线上的拒绝规则要等 `cloud/` 部署（本次读线上目录时还没有 `clip` 字段），真实 CDN 缓存和官网页面本身都没有在这里走过（官网页面属 site 模块）。
