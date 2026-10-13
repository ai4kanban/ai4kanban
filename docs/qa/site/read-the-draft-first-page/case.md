# 读 draft-first 落地页并复制安装命令

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`），并授予剪贴板权限；脚本是 [draft-first.mjs](draft-first.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。首屏视频来自线上 `cdn.ai4kanban.dev`。
- **安装命令**：在 `/tmp` 下一个空 git 项目里，用空的 `HOME` 和 npm 缓存跑页面上复制来的命令。
- **读者**：用 Claude Code、Codex 等写代码，想让 agent 先出草稿再动手的人；从首页页脚或博客文章进来。

## Steps

1. 在首页滚到页脚，点「SOLUTIONS」下的「draft-first」。
   「SOLUTIONS」下有「For coding」和「draft-first」两条；页头导航里没有这一页。点完到 `/draft-first`，标签页标题「draft-first: Preview AI drafts before the build」。
   ![页脚入口](01-footer-link.png) · [draft-first.log](draft-first.log)

2. 看首屏，再用 390px 宽的手机打开同一页。
   页头是站点原有的 AI4Kanban 页头。主标题上方是举着剪贴板的小机器人和小写字标「draft-first」；标题两行「See the draft. / Then build.」，下面一行说明，然后是带「Copy」按钮的 `$ npx draft-first install` 和「Run again to update. · GitHub」，再下面「WORKS WITH」后一排七个灰色 logo（Claude Code、Codex、Cursor、OpenCode、DeepSeek Harness、ZCode、Grok Build）。再往下是浅灰水彩底里的一段录屏：静音、循环、自己播放（3 秒后从 5.9 秒走到 8.9 秒），录的是审阅页上删除、批注、确认的过程。手机上命令框不出屏，页面不横向滚动，录屏裁成 4:3。
   ![首屏](02-hero.png) · ![手机首屏](02b-hero-phone.png) · ![手机上的录屏](02c-video-phone.png) · [draft-first.log](draft-first.log)

3. 点命令旁的「Copy」。
   按钮变成「✓ Copied」，剪贴板里是 `npx draft-first install`；约 2 秒后变回「Copy」。
   ![已复制](03-copied.png) · [draft-first.log](draft-first.log)

4. 点命令下方的「GitHub」。
   链接在同一标签页打开公开仓库 `https://github.com/ai4kanban/draft-first`（返回 200），仓库根目录就是 `SKILL.md`、`README.md`、`page/`、`server/`、`test/` 等，仓库主页链接回 `ai4kanban.dev/draft-first`。站点的 `llms.txt` 里 draft-first 那条也以 `Source: https://github.com/ai4kanban/draft-first` 结尾。
   ![GitHub 链接](04-github-link.png) · [draft-first.log](draft-first.log)

5. 往下读「01」到「03」三节。
   「Draft the parts that matter」是 2×2 四张草稿缩略图：界面、Prompt 与样例输出、文案、配图，各配一行说明，下面一行带过技术选型和竞品对比，收在「Leave the rest to your agent.」。「Get the draft right. Then build from it.」是删除、批注、确认三张小图并排，导出只占一行字。「You choose what gets drafted」说内置六个草稿 agent，旁边是 `.draft-first/helpers/storyboard.md` 的示例和「Copy」按钮。到这里正文还没提 AI4Kanban。
   ![草稿样例](05a-drafts.png) · ![审阅三步](05b-review.png) · ![添加草稿 agent](05c-helpers.png) · [draft-first.log](draft-first.log)

6. 读「04」节。
   标题「Too many tasks? Bring them to AI4Kanban.」，「AI4Kanban」前有它的 logo；三张看板样式的图分别讲记住偏好、多任务并行、提出跟进项；下面「Download AI4Kanban」到 `/download`，「Explore AI4Kanban」到首页。
   ![升级到 AI4Kanban](06-upgrade.png) · [draft-first.log](draft-first.log)

7. 读最后的「FAQ」。
   三问纯文字：草稿存在项目的 `.draft-first/`；支持读取 `.claude/skills/` 或 `.agents/skills/` 的编码 agent；卸载时删掉这两处的 `draft-first` 目录，草稿要先备份再删 `.draft-first/`。
   ![FAQ](07-faq.png) · [draft-first.log](draft-first.log)

8. 打开 `/zh/draft-first`。
   标题两行「先看草稿 / 再往下做」，按钮「复制」，五节标题都是中文；录屏换成中文审阅页（`hero-zh-v1`）。
   ![中文首屏](08-zh-hero.png) · [draft-first.log](draft-first.log)

9. 打开博客「show-the-ui-first」，读到最后。
   末尾一句「Install the draft-first skill …」，「draft-first skill」链到 `https://ai4kanban.dev/draft-first`。
   [draft-first.log](draft-first.log)

10. 在一个空项目里跑复制来的 `npx draft-first install`。
   现在跑不通：npm 上还没有 `draft-first` 这个包，`npx` 报 `E404` 退出。源码已拆到上面的公开仓库，按 #1635、#1673，包由维护者在那里自己发布，页面等发布后才上线，所以这里不算产品故障；包发布后重跑这一步，应当把技能装进项目的 `.claude/skills/` 和 `.agents/skills/`。
   [install.log](install.log)

## Feedback

- **一屏就懂**：标题、一行说明、一条命令、一段真实录屏，看完就知道它做什么、怎么装；复制按钮反馈清楚。
- **源码终于有入口**：命令下多了一个「GitHub」，想先看代码或提 issue 的人不用再去翻 AI4Kanban 主仓库；但它是一行小灰字，又在同一标签页打开，读到一半点进去就离开了落地页。
- **图比字多，读得快**：四种草稿和审阅三步都是照真实界面画的图，比说明文字直观；AI4Kanban 到第四节才出现，不抢 draft-first 的主角位置。
- **还是装不上**：页面上的主要行动仍是一条 404 的命令；仓库已公开、包却没发，读者只能自己从仓库手动装。
- **logo 栏要靠悬停**：七个灰色小图标没有文字，认不出 DeepSeek Harness、ZCode 的读者只能悬停看提示。
- **手机上录屏字太小**：4:3 裁切后审阅页的文字几乎读不清，只能看个动作轮廓。
