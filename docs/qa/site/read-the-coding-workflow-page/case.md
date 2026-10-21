# 读软件开发方案页

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`，默认 `127.0.0.1:4330`），无头 Chrome 开远程调试（`CDP_PORT`）；脚本是 [coding.mjs](coding.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），窗口 1280×900，手机 390×844。录屏视频来自线上 `cdn.ai4kanban.dev`。
- **读者**：用 Claude Code、Codex 等写代码，想知道 AI4Kanban 能帮什么的人；从页脚、搜索或别人给的链接进来。

## Steps

1. 在首页滚到页脚，点「SOLUTIONS」下的「For coding」。
   页脚四栏：「PRODUCT」；「SOLUTIONS」（「For coding」「For SaaS」）叠在「LEARN」上面；「COMPARE」；「PROJECT」叠在「LEGAL」上面。手机上两栏，同样的顺序两两成行，页面不横向滚动。中文首页的分组叫「解决方案」，链接是「编程」「SaaS」，指向 `/zh/workflows/coding` 和 `/zh/solutions/saas`。点完到 `/workflows/coding`。
   ![桌面页脚](01-footer-solutions.png) · ![手机页脚](01b-footer-phone.png) · [coding.log](coding.log)

2. 看首屏，等几秒，再用 390px 宽的手机打开同一页。
   标签页标题「AI coding workflow: review drafts before building | AI4Kanban」。页面和页头都是纯白，背后没有任何动画背景。标题「AI4Kanban for coding」，副标题「Coding in your agent workspace. Review the key drafts, then let agents build from what you approved.」，下面直接是和 SaaS 方案页同一幅 3D 动画，不带画框：浅灰看板斜放在白底上，带橙色描边的卡片升起、展开成一张抽象的卡片页（标题、橙色执行按钮、一份页面草稿），之后收回到看板上；没有文字也没有机器人。图片说明是「A card lifts off the board and opens into its card page, where agents' drafts fill in; you press Run and the card starts building.」。动画桌面宽 896px，手机宽 342px，页面不横向滚动。往下才是左侧的「ON THIS PAGE」目录（手机上折叠成一条），列出十个小节。此时这一页还没有请求任何视频（日志里的 `hero-demo-v1.mp4` 是先前首页的），也没有 GIF。
   ![卡片页展开](02-hero.png) · ![收回看板](02a-hero-board.png) · ![手机首屏](02b-hero-phone.png) · [coding.log](coding.log)

3. 读第一节「Get the key details right before implementation.」，再打开 `/zh/workflows/coding` 读同一节。
   三段：一个功能的来回修改大多落在界面、Agent 指令、文案或邮件这几处；AI4Kanban 在写代码前把它们作为草稿放到任务卡片上，由内置专业 Agent 准备；你审草稿、回答问题，Agent 按确认的草稿和计划实现，小修复直接做。中文页标题「AI 编码工作流：先审草稿，再开发 | AI4Kanban」，导语「在 Agent 工作台里推进开发。你先审关键草稿，agent 按确认的版本继续实现。」，第一节标题「你要把关的，往往就是几个关键点」，三段意思相同。
   ![第一节](02c-first-section.png) · [coding.log](coding.log)

4. 往下滚到第一段录屏。
   滚到附近才开始下载 MP4；录屏静音、循环、没有控制条，自己播放（3 秒后进度从 3.3 秒到 6.4 秒），画面是演示项目里一张卡片的待答问题和草稿。
   ![录屏在播放](03-recording-playing.png) · [coding.log](coding.log)

5. 滚回顶部。
   录屏离开视野后自动暂停。
   [coding.log](coding.log)

6. 看页面里往下走的链接。
   「Setup guide」到 `/docs`，「Agent guide」到 `/docs/agents`，「supported tool」到 `/docs/connectors`。
   [coding.log](coding.log)

7. 打开系统的「减少动态效果」后重新打开页面，滚到同一段录屏。
   录屏不自动播放，停在封面上，显示浏览器自带的播放控件，由读者自己点开。
   ![减少动态效果时](06-reduced-motion.png) · [coding.log](coding.log)

## Feedback

- **开头说中了痛点**：导语和第一节从「改来改去总在那几处」讲起，再给出「先审草稿、再让 Agent 照着做」，比原来的「Review what matters」具体，读者马上知道省的是哪种返工；「agent workspace」也和 SaaS 页、Claude Code 页口径一致。
- **中文混用大小写**：中文页改过的开头几段写小写「agent」，后面各节仍是「Agent」，同一页两种写法。
- **首屏动画抽象**：「卡片升起 → 展开成卡片页 → 执行」的 3D 动画干净，但没读正文的人看不出浮起的是卡片页，画面颜色很淡；卡片收回看板后，标题下空着一大块白。和 SaaS 页首屏一模一样，只能靠标题区分。
- **入口清楚**：页脚「SOLUTIONS」放在第二栏最上面，三个方案页并排；页头「Resources」面板里仍然没有这一页。
- **看得到真东西**：每节配真实产品录屏，比示意图更可信；视频滚到附近才加载、离开就停，减少动态效果时改为手动播放。手机上动画缩到 342px，卡片页里的草稿只剩几根线条。
- **页内没有下载按钮**：读完想试，只能回到页头点「Download」。
