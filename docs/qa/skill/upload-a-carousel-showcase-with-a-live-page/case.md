# 给图文模板上传按顺序排好的多页展示，其中一页带实况视频

## Setup

- **模板**：已发布的免费图文模板 `promo-carousel-free`（发布过程见 `publish-a-template-without-access-or-source`）。
- **展示资料**：`show/` 里三张竖版页面图 `01.png`–`03.png`、一段 2 秒的 `02.mp4`，和一份 `showcase.json`：封面是 `01.png`，`pages` 依次是 `01.png`、`{ "image": "02.png", "video": "02.mp4" }`、`03.png`。
- **账号**：维护者 `neverchanje` 上传，普通免费账号 `lin` 试着上传。
- **本次证据的来源**：没碰线上 Cloud。[server.mjs](server.mjs) 在 `127.0.0.1:8847` 上跑工作树里真实的 Worker 代码，Supabase 和 R2 在内存里顶替；[akb.sh](akb.sh) 用干净环境跑这次构建出的 `akb`。Worker 日志见 [00-setup.log](00-setup.log)。

## Steps

1. 看 `show/showcase.json` 和目录里的文件。
   第二页写成 `{ image, video }`，其余两页是图片名。
   [01-showcase.log](01-showcase.log)

2. 维护者执行 `akb cloud template showcase promo-carousel-free show`。
   「已更新 promo-carousel-free 的展示资料：4 个文件。」，退出码 0：三张图加实况页的视频都传上去了。
   [02-upload.log](02-upload.log)

3. 不登录读官网用的目录接口 `/v1/catalog/promo-carousel-free`。
   `pages` 按 01、02、03 排好；第二页同时有 `image` 和 `video`，另两页 `video` 为 `null`；封面是 `01.png`。
   [03-detail.log](03-detail.log)

4. 带 `Range` 请求第二页的视频地址。
   `206 Partial Content`、`content-type: video/mp4`、长期缓存，官网能边下边播、拖动。
   [04-video.log](04-video.log)

5. 把一页写成只有 `video` 没有 `image`、或把视频名直接写进 `pages`，再上传；再用免费账号上传。
   前两次被拒，退出码 1：`pages[0].image is the still shown before the page plays.` 和 `pages[0] is a file name ending in .png, …`；免费账号被拒：「只有模板库维护者可以发布或删除模板。」
   [05-refused.log](05-refused.log)

## Feedback

- **写法顺手**：静态页仍是一个文件名，实况页换成 `{ image, video }`，老的展示资料不用改。
- **命令不告诉你传了什么**：只回「4 个文件」，没列出哪几页、哪页是实况；要确认顺序得自己去读目录接口或打开官网。
- **报错半中半英**：校验错误前缀是中文「模板未通过校验」，后半句是 Worker 原样的英文，中文界面下读着别扭。
- **没有跑到的**：官网模板详情页里竖版多页的翻页和实况播放（属 site 模块）；线上 Cloud 和真实 R2。
