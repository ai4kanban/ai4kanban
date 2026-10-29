# 打开分享出来的卡片链接

## Setup

- 拿到一个 `https://api.ai4kanban.dev/card/<board>/<task>` 形式的卡片链接。

## Steps

1. 打开链接（这里用 `curl` 看它的响应），再换一个不存在的看板和任务号。
   预期：两者都 302 到 `ai4kanban://card/<board>/<task>`，交给本机应用打开；响应不透露
   卡片是否存在。
   证据：[01-redirect.log](01-redirect.log)

## Feedback

链接可以贴进任何只认 http 的地方，行为简单可预期。但没装应用的人点开后浏览器只会静默失败
或弹出「无法打开」，没有任何落地页告诉他这是什么、去哪下载。
