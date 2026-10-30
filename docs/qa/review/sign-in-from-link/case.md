# 从公开的审核链接登录

## Setup

- 本地云端栈（见 README「如何运行取证」）。任务「订单页加导出按钮」在等审核，有一条「任何拿到链接的人」的链接，
  carol@example.com 是受邀的人，dave@example.com 不是工作区成员，也没受邀。
- 验证码由 Auth 替身固定为 `246810`，GitHub 登录和失败也由替身代答。工作区成员登录见
  [工作区成员打开分享链接](../member-opens-link/case.md)。

## Steps

1. 未登录打开这条链接。
   预期：只读审核页，右上是语言切换和「登录」，没有评论。
   证据：[01-visitor.png](01-visitor.png)
2. 点「登录」。
   预期：「登录 WildCrane」页，写着「工作空间成员登录后直接进入任务页。」，有 GitHub、邮箱验证码和「返回审核页」。
   地址不变。
   证据：[02-sign-in.png](02-sign-in.png)
3. 点「返回审核页」。
   预期：回到只读审核页，地址不变。
   证据：[03-back.png](03-back.png)
4. 再点「登录」，用 carol 的邮箱验证码登录。
   预期：留在这条链接，右上是「评论」和 carol 的邮箱，没有「登录」，也没有「和 AI 讨论」。
   证据：[04-guest.png](04-guest.png)
5. 打开「评论」，写一条评论发送。
   预期：评论出现在评论栏，计数变为 1。
   证据：[05-comment.png](05-comment.png)
6. 退出后重新打开链接，点「登录」，用 GitHub 以 dave 登录。
   预期：留在这条链接，仍是只读，右上只有 dave 的账号菜单，没有「这个链接仅限受邀的人」。
   证据：[06-stranger.png](06-stranger.png)
7. 从账号菜单「退出登录」。
   预期：回到只读审核页，右上又是语言切换和「登录」。
   证据：[07-signed-out.png](07-signed-out.png)
8. 点「登录」和「用 GitHub 登录」，这次 GitHub 拒绝登录。
   预期：回到登录页，地址还是这条链接，邮箱框下方写「登录没有完成，请重试。」
   证据：[08-github-failed.png](08-github-failed.png)
9. 点「返回审核页」，刷新。
   预期：只读审核页，不再提示失败。
   证据：[09-after-failed.png](09-after-failed.png)
10. 语言选 English，点「Sign in」。
    预期：登录页标题是「Sign in to WildCrane」，有「Workspace members go straight to the task.」和「Back to review」。
    证据：[10-english.png](10-english.png)
11. 手机宽度（390px）打开链接。
    预期：顶栏放得下语言切换和「登录」，按钮高 36px。
    证据：[11-phone.png](11-phone.png)
12. 点「登录」。
    预期：登录页完整显示，「返回审核页」不用滚动就能看到。
    证据：[12-phone-sign-in.png](12-phone-sign-in.png)

## Feedback

入口就在语言切换旁边，一眼能找到；反悔也有路，点「返回审核页」回到原处，GitHub 失败时也会明说，不再悄悄回到只读页。摩擦点：
登录页只提成员，受邀的客人看不出登录后能评论，点之前也不知道自己算不算成员；陌生人登录后除了右上多一个账号，页面上什么都没
变，没有一句话说明为什么还是只读，也不知道该找谁要权限。
