# 在联系页发一条消息

## Setup

- **站点**：官网（`web/`）在本地跑起来（`next dev`），无头 Chrome 打开 `/contact`，窗口 1280×1600；脚本是 [contact.mjs](contact.mjs)（用 [cdp.mjs](cdp.mjs) 驱动浏览器）。
- **接口替身**：页面直接从浏览器调 `https://api.ai4kanban.dev/v1/contact`。为了不真的给团队发信，[api-stand-in.js](api-stand-in.js) 在页面加载前换掉 `fetch`：记下发往这个域名的每个请求，并按步骤给出回答；其他请求照常发出。
- **读者**：需要帮助、或想请团队定制 Agent 的人。

## Steps

1. 什么都不填，点「Send message」。
   邮箱框和消息框变红，下面分别写「Enter your email address. Our reply goes there.」「Write a message.」；没有发出任何请求。
   ![空表单被拦下](01-empty.png)

2. 在「What do you need?」里选「Done-for-you agents」。
   这一项展开一行价格说明「A 5-agent workflow is $75. Quote and payment by email.」，右侧多出「Describe your workflow」一栏。
   ![选了定制 Agent 后的表单](02-done-for-you.png)

3. 填邮箱 `qa@example.com`、消息和工作流描述，点「Send message」（替身回 200）。
   发出一个 `POST /v1/contact`，带 `opId`、`reason: customize`、邮箱、消息和 `workflow`；表单换成「Message received · We will reply to qa@example.com.」和「Send another message」。
   ![发送成功](03-sent.png) · [contact.log](contact.log)

4. 重新打开页面，选默认的「Support」，填好后发送（替身回 429 `contact_too_many_attempts`）。
   表单留着刚写的内容，下面出现「Too many messages from here · What you wrote is kept. Try again later, or email support@ai4kanban.dev.」。
   ![被限流](04-limited.png) · [contact.log](contact.log)

## Feedback

表单短、校验就地显示，选「Done-for-you agents」时价格和多出的一栏一起出现，知道自己在买什么。成功页把回信地址复述一遍，很安心；被限流时内容不丢，还给了备用邮箱，处理得体。真实的接口没有走到——第 3、4 步的回答来自替身，信是否真的进了团队邮箱、限流阈值是多少，这里证明不了。
