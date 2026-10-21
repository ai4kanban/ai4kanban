# 维护者给已发布的模板登记展示资料（含图文的整套页面），官网不登录就能读到目录

## Setup

- **账号**：维护者（GitHub 账号在 `TEMPLATE_PUBLISHERS` 里）已在 AI4Kanban 登录；另有一个普通免费账号 `lin`。官网 `/templates` 读的就是这里的公开目录，这里直接用 `curl` 读它，不带任何登录态。
- **模板库**：维护者已发布五个模板：`ui` 类的 `hero-tilted-screen`（带一张目录预览图）、`video` 类的 `ui-walkthrough-launch`（没有预览图）、`motion` 类的 `card-widen`（只有一张关键帧预览图），以及 `carousel` 类的 `long-read`（静态页，#1903）和 `warm-explainer`（动态页，#1910），两个图文模板的 `template.md` 没写 `access`，按默认发布为 Pro。展示资料是 `showcase.json` 和它点名的图片、视频；`card-widen` 的片段是 4 秒的 `clip.mp4`，图文的页面取各自卡片的英文示例：`long-read` 7 张 3:4 PNG，`warm-explainer` 8 页各一个 mp4 和封面帧。
- **本次证据的来源**：没碰线上 Cloud。[pg.sh](pg.sh) 起一个临时 PostgreSQL 并应用全部迁移；[server.mjs](server.mjs) 在 `127.0.0.1:8811` 上跑本交付的 Worker 代码，Supabase 的 JWKS 由它顶替、RPC 在这个库里真的执行，R2 换成支持分段读取的内存桶，并为两个账号写好登录态；[akb.sh](akb.sh) 用干净环境跑本交付构建的 `akb`；[publish.sh](publish.sh) 发布五个模板，[run.sh](run.sh) 跑下面每一步。发布过程和 Worker 日志见 [00-setup.log](00-setup.log)。

## Steps

1. 不登录，`curl http://127.0.0.1:8811/v1/catalog`。
   返回 200，带 `access-control-allow-origin: *` 和 `cache-control: public, max-age=60`；模板按类别分成 `carousel`、`motion`、`video`、`ui` 四组，每个只有名称、标题、摘要、标签、免费／Pro、封面、时长和片段地址 `clip`。两个图文模板是 `pro`，其余写明了 `access: free` 的是 `free`。还没登记展示资料时，有预览图的用预览图作封面，`ui-walkthrough-launch` 的封面是 `null`；时长和 `clip` 都是 `null`。
   [01-catalog-before.log](01-catalog-before.log)

2. 维护者运行 `akb cloud template showcase hero-tilted-screen showcase/hero-tilted-screen`，再对 `ui-walkthrough-launch` 运行一次。
   分别提示「已更新 hero-tilted-screen 的展示资料：2 个文件。」「已更新 ui-walkthrough-launch 的展示资料：3 个文件。」——同一张图被封面和复刻两处点名时只传一次。
   [02-showcase.log](02-showcase.log)

3. 维护者给 motion `card-widen` 登记只有封面和关键帧、没有 `recreation.video` 的展示资料；再换成带 `clip.mp4`、时长 4 的那份。
   第一次被拒、退出码 1：「A motion plays its clip: send recreation.video.」，什么都没传；第二次提示「已更新 card-widen 的展示资料：2 个文件。」
   [03-motion-clip.log](03-motion-clip.log)

4. 再读一次 `/v1/catalog`。
   `hero-tilted-screen` 和 `ui-walkthrough-launch` 的封面换成登记的 `recreation.jpg`，视频模板带上时长 `69`，但 `clip` 仍是 `null`：只有 motion 带片段。`card-widen` 的封面换成片段里的 `cover.jpg`，时长 `4`，`clip` 是它的 `clip.mp4` 地址。
   [04-catalog-after.log](04-catalog-after.log)

5. 不登录，`curl http://127.0.0.1:8811/v1/catalog/ui-walkthrough-launch`。
   多出描述、发布时间、来源（原站、参考链接、带时区的采集时间）、原作与复刻两侧（原作是一张图加 YouTube 视频 id，复刻是一张图加 mp4 地址），以及空的 `pages: []`。不含来源 `note`、文件清单、凭证或发布者。
   [05-detail.log](05-detail.log)

6. 下载详情里的封面；对复刻视频地址和 `card-widen` 目录里的 `clip` 地址各发一次带 `range: bytes=0-1023` 的请求，再整段下载。
   封面与登记的 `recreation.jpg` 逐字节相同；两个视频都答 206，`content-range` 分别是 `bytes 0-1023/13783454` 和 `bytes 0-1023/44067`，整段下载与原 mp4 相同；媒体都标 `immutable`，可永久缓存。
   [06-media.log](06-media.log)
   ![](06-cover.jpg)

7. 维护者给图文模板 `long-read` 登记 `{ "cover": "example-en-3x4-01.png", "pages": [ …01 到 07 共 7 个文件名… ] }`，再读它的详情。
   提示「已更新 long-read 的展示资料：7 个文件。」——封面与第 1 页同一张图只传一次。详情的 `pages` 按登记顺序给出 7 项，每项是 `{ image, video: null }`；第 7 页的地址下载下来与原图逐字节相同。
   [07-carousel-pages.log](07-carousel-pages.log)
   ![](07-page-1.png)

8. 维护者给 `warm-explainer` 登记 8 页动态页，每页写成 `{ "image": "page-4x5-0N-en.png", "video": "page-4x5-0N-en.mp4" }`，再读详情，对第 3 页的视频发一次分段请求并整段下载。
   提示「已更新 warm-explainer 的展示资料：16 个文件。」（超过旧上限 12 也能登记）；详情的 8 项都带 `image` 和 `video` 两个地址；视频答 206、`content-range: bytes 0-1023/4676497`、`immutable`，整段与原 mp4 相同。
   [08-live-pages.log](08-live-pages.log)

9. 给 `long-read` 依次登记 13 页、一页只有 `video` 没有 `image`、把 mp4 直接写成一页，最后读它的详情。
   三次都被拒、退出码 1：「pages is a list of 1 to 12 pages, in order.」「pages[0].image is the still shown before the page plays.」「pages[0] is a file name ending in .png, .jpg, .jpeg, .webp, .gif.」；详情仍是之前的 7 页。
   [09-pages-refused.log](09-pages-refused.log)

10. 维护者用 `--replace` 重新发布 `hero-tilted-screen`。
    提示「已替换 hero-tilted-screen：5 个文件。」，详情里的封面和原作图地址前后不变：展示资料随替换保留。
    [10-replace.log](10-replace.log)

11. 维护者对 `hero-tilted-screen` 只登记一个封面（`{ "cover": "recreation.jpg" }`）。
    提示「1 个文件」；详情的封面换了新地址，原作与复刻都变成 `null`，之前原作图的地址答 404：新登记整份替换旧的。
    [11-reregister.log](11-reregister.log)

12. 用缺 `showcase.json` 的文件夹、坏 JSON、点名了不存在的文件、YouTube 字段填了别的网址、不存在的模板各登记一次；再用普通账号 `lin` 登记。
    每次都被拒、退出码 1：「…中缺少 showcase.json」「showcase.json 不是有效的 JSON」「找不到文件 …」「original.youtube is a YouTube video's URL.」「模板库里没有这个模板」；普通账号是「只有模板库维护者可以发布或删除模板。」
    [12-refused.log](12-refused.log)

13. 不登录，取模板文件、来源记录，用目录的媒体地址取模板文件，对目录发 `POST`，读不存在的模板。
    依次是 401、401（「Sign in to reach this workspace.」）、404「This template has no such file.」、405、404「No template has this name.」：公开目录拿不到源码。
    [13-anonymous.log](13-anonymous.log)

14. 维护者运行 `akb cloud template delete ui-walkthrough-launch`，再读目录、详情和之前的视频地址。
    目录只剩 `ui`、`carousel`、`motion` 三组，详情和视频地址都答 404「No template has this name.」。
    [14-delete.log](14-delete.log)

## Feedback

- **登记一步到位**：一个文件夹、一份 `showcase.json`，命令把点名的文件一起传上去；发布、替换、下架后目录随之变化，不用改官网代码。
- **图文整套页面好登记**：`pages` 按顺序写文件名就行，动态页写成 `{ image, video }`，同一张图被封面和第 1 页共用只传一次；8 页动态页 16 个文件、8 MB 一次传完。但 `pages` 只能手写，没有「把这个文件夹里的图按名字顺序全登记」的快捷方式，12 页的套图要写 12 行。
- **页面的错误挡得住，提示偏工程味**：超过 12 页、动态页缺封面帧、把视频当页面都在本地就被拒；提示是英文，前面还套着「模板未通过校验：」，而错的是展示资料不是模板。
- **motion 缺片段挡得住**：只有关键帧的 motion 登记不进去，官网拿到的 `clip` 就是能分段播放的 mp4；拒绝同样只有一句英文，没说片段该是几秒、多大、静音。
- **替换模板不丢展示资料**：重新发布保留封面和对照图；反过来，重新登记是整份覆盖，只想换封面也得把原作、复刻、页面一起写上，否则它们悄悄消失，命令输出里看不出来。
- **公开部分收得紧**：目录和详情只给展示用的字段，源码、凭证、来源说明都要登录；媒体地址带版本、可永久缓存，视频支持分段读取。
- **其他用词问题**：普通账号被拒时说的是「发布或删除模板」，没提登记展示资料；英文提示只传一个文件时是「1 files」。`showcase.json` 的字段只能去 `cloud/endpoints.md` 查，命令帮助里没写；而那里还没写 `pages`，上限也仍写着 12 个文件，实际已是 30。
- **未在真实 Cloud 上验证**：R2 和 Supabase 是替身，数据库是临时 PostgreSQL；真实 CDN 缓存和官网页面本身（页面带的横排和播放属 site 模块）都没有在这里走过。
