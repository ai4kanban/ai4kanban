# 预约一次培训

## Setup

- **站点**：官网（`web/`）的静态构建用 `wrangler pages dev` 跑在 `127.0.0.1:4330`，无头 Chrome 打开 `/training`，窗口 1280×1600，手机 390×844，时区设成 `Asia/Shanghai`；脚本是 [training.mjs](training.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器），第二个参数是取到的可预约时段 JSON。
- **接口替身**：页面直接从浏览器调 `https://api.ai4kanban.dev`，线上服务只认官网自己的来源，本地页面读不到。[api-stand-in.js](api-stand-in.js) 在页面加载前换掉 `fetch`：可预约时段原样返回线上服务当时的回答（[01-live-availability.log](01-live-availability.log)），预约请求不发出去，由替身回答，免得占掉真实的时段。
- **读者**：想约创始人一对一聊项目的独立开发者。

## Steps

1. 点页面上的「Book a session」。
   页面滚到「Start with a conversation」（地址带 `#booking`），显示本地时间的一周：「10 October – 16 October · Next 7 days」「Your local time · Asia/Shanghai」，00:00–10:00 折叠成一行；线上给出的三个时段（周一 12 日 10:00、周三 14 日 22:00、周五 16 日 22:00）标「Available」。
   ![一周的可预约时段](01-week.png) · [booking.log](booking.log)

2. 点周一 12 日 10:00。
   换成「Your details」：顶上是「Monday 12 October, 10:00–11:00」，下面要填 Name、Email，选服务（60 分钟单次 $99 或每月四次 $349），「About your project」可不填；按钮「Confirm booking」旁写明现在不收费，付款和发票之后邮件安排。
   ![填写预约信息](02-form.png)

3. 填姓名 `QA Tester`、邮箱 `qa@example.com` 和项目说明，点「Confirm booking」（替身回 200 和预约号 `TR-QA0001`）。
   发出一个 `POST /v1/training/bookings`，带 `slotAt: 2026-10-12T02:00:00Z`、`timezone`、`service: single` 和填的内容；页面显示「Booking confirmed」、服务、时间、预约号，以及「Add to calendar」「Cancel this booking」。
   ![预约成功](03-booked.png) · [booking.log](booking.log)

4. 重新打开页面，点周三 14 日 22:00，填好后确认（替身回 409 `training_slot_taken`）。
   表单上方出现「This time has just been booked · Your details have been saved. Choose another time to continue.」，姓名和邮箱还在，按钮变成「Pick another time」。
   ![时段被人抢先](04-taken.png) · [booking.log](booking.log)

5. 用 390px 宽的手机打开 `/training`，点「Book a session」，再试着把整页往右滑。
   整页宽度等于屏幕宽度，往右滑不动；顶栏、日历都在屏幕内，日历先显示三天，其余日期在日历框里横向滑动。
   ![手机上的页面顶部](05-phone-top.png) · ![手机上的一周](06-phone-week.png) · [booking.log](booking.log)

## Feedback

流程顺：点按钮直接落到日历，时间按访客自己的时区显示，选中后时段一直钉在表单顶上，不会忘了约的是哪一刻。被抢先时内容保留、按钮直接换成「Pick another time」，挫败感很小。一周里只有三个空档，空白的格子占了大半屏，第一眼像是「全满」；手机上更明显，三天里往往只看到一个空档，后面的得在日历框里横着找，没有提示可以滑。整页不再左右晃，这点手机上舒服多了。这里没有走到真实的预约服务：预约号、确认邮件和管理链接都只证明了页面如何呈现替身的回答。
