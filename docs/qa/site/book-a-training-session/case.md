# 预约一次培训

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在本机（地址给 `SITE`），无头 Chrome 打开 `/training`，窗口 1280×1600，手机 390×844，时区设成 `Asia/Shanghai`；脚本是 [training.mjs](training.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），第二个参数是取到的可预约时段 JSON；脚本预约这周第一个空档，第二个空档用来演示被抢先。
- **接口替身**：页面直接从浏览器调 `https://api.ai4kanban.dev`，线上服务只认官网自己的来源，本地页面读不到。[api-stand-in.js](api-stand-in.js) 在页面加载前换掉 `fetch`：可预约时段原样返回线上服务 2026-10-23 对页面「Next 7 days」的回答（[01-live-availability.log](01-live-availability.log)，请求带 `Origin: https://wildcrane.ai`），预约请求不发出去，由替身回答（管理链接给 `https://wildcrane.ai/training?…`），免得占掉真实的时段。接口仍是 `api.ai4kanban.dev`，改名后有意保留旧域名。
- **读者**：想约创始人一对一聊项目的独立开发者。

## Steps

1. 往下滚到「Your coach」。
   「Tao Wu, creator of WildCrane」旁边是照片，介绍里说他开发了 WildCrane——「an agent workspace for indie hackers」，并用它开发产品自己的看板、桌面应用和网站；下面是「Why I built WildCrane →」。中文页 `/zh/training` 同一句是「他开发了 WildCrane——独立开发者的 Agent 工作台」（这次只抓了培训页，没法对照首页的叫法）。
   ![导师介绍](00-coach.png) · [booking.log](booking.log)

2. 点页面上的「Book a session」。
   页面滚到「Start with a conversation」（地址带 `#booking`），向服务要从今天零点起 7 天的时段，显示本地时间的一周：「23 October – 29 October · Next 7 days」「Your local time · Asia/Shanghai」，00:00–10:00 折叠成「not available」一行；线上给出的两个时段（周一 26 日 10:00、周三 28 日 22:00）标「Available」。
   ![一周的可预约时段](01-week.png) · [booking.log](booking.log)

3. 点周一 26 日 10:00。
   换成「Your details」：顶上是「Monday 26 October, 10:00–11:00」，下面要填 Name、Email，选服务（60 分钟单次 $99 或每月四次 $349），「About your project」可不填；按钮「Confirm booking」旁写明现在不收费，付款和发票之后邮件安排。
   ![填写预约信息](02-form.png)

4. 填姓名 `QA Tester`、邮箱 `qa@example.com` 和项目说明，点「Confirm booking」（替身回 200 和预约号 `TR-QA0001`）。
   发出一个 `POST /v1/training/bookings`，带 `slotAt: 2026-10-26T02:00:00Z`、`timezone`、`service: single` 和填的内容；页面显示「Booking confirmed」、服务、时间、预约号，以及「Add to calendar」「Cancel this booking」。
   ![预约成功](03-booked.png) · [booking.log](booking.log)

5. 重新打开页面，点周三 28 日 22:00，填好后确认（替身回 409 `training_slot_taken`）。
   表单上方出现「This time has just been booked · Your details have been saved. Choose another time to continue.」，姓名和邮箱还在，按钮变成「Pick another time」。
   ![时段被人抢先](04-taken.png) · [booking.log](booking.log)

6. 用 390px 宽的手机打开 `/training`，点「Book a session」，再试着把整页往右滑。
   整页宽度等于屏幕宽度，往右滑不动；顶栏、日历都在屏幕内，日历先显示三天（周五到周日，一个空档都没有），其余日期在日历框里横向滑动。打开时的那一屏里，顶栏（飞鹤加「WildCrane」、GitHub、下载、菜单）和「Start with a conversation」下的日历都在屏内。
   ![手机上打开时的一屏](05-phone-top.png) · ![手机上的一周](06-phone-week.png) · [booking.log](booking.log)

## Feedback

- **流程顺**：点按钮直接落到日历，时间按访客时区显示，选中的时段钉在表单顶上，不会忘了约的是哪一刻。
- **被抢先不丢内容**：姓名邮箱保留，按钮直接换成「Pick another time」，挫败感很小。
- **改名已贯通**：导师标题、介绍、「Why I built WildCrane」和中英文页都已是 WildCrane，没看到旧名。
- **介绍没接上需求**：「独立开发者的 Agent 工作台」没说清这个产品和「帮你把项目做出来」有什么关系，要点进「Why I built」才知道。
- **空档少**：一周只有两个（周一上午 10 点、周三晚 10 点），大片空白格第一眼像「几乎约不到」。
- **手机上看不到空档**：前三天（周五到周日）一个都没有，两个空档都得在日历框里横着找，没有提示可以滑。
- **未走真实服务**：预约号、确认邮件和管理链接只证明页面如何呈现替身的回答。
