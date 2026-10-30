# 打开不完整或失效的审核链接

## Setup

- 线上 `https://app.wildcrane.ai`，浏览器未登录，语言选中文。

## Steps

1. 只打开 `https://app.wildcrane.ai/s/`，不带链接码。
   预期：「请从收到的链接打开」，说明需要发送者给的完整链接。
   证据：[01-no-token.png](01-no-token.png)
2. 打开一个被截断的链接 `https://app.wildcrane.ai/s/<半截链接码>`。
   预期：「链接已失效」，说明已过期或被撤销，请向发送者索取新链接。
   证据：[02-bad-token.png](02-bad-token.png)

## Feedback

两种情况各有一句清楚的话，告诉人该做什么。摩擦点：截断的链接也说成「已过期或被撤销」，
复制漏了几个字符的人会以为真被撤销了；页面没有任何去处，连 WildCrane 是什么的链接都没有。
