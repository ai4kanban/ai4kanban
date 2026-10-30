# 查看价格并选择方案

## Setup

- 浏览器未登录 GitHub，打开 `https://api.ai4kanban.dev/pricing`。

## Steps

1. 打开 `/pricing?lang=en`，等价格数字滚动停下。
   预期：Free $0 与 Pro $19 两列，额度和功能逐行对比，右上角有「中文」切换；Pro 列列出配音每分钟
   160 / 270、生图每张 230 / 320 / 769、音乐每首 160 积分，Free 列是「—」。
   证据：[01-pricing-en.png](01-pricing-en.png)
2. 点右上角「中文」（即 `/pricing?lang=zh`）。
   预期：整页换成中文，数字与英文版一致，右上角变为「English」。
   证据：[02-pricing-zh.png](02-pricing-zh.png)
3. 不带 `lang`，以 `Accept-Language: zh-CN` 请求 `/pricing`。
   预期：直接返回中文页（`lang="zh-CN"`，标题「定价 · WildCrane」）。
   证据：[03-accept-language-zh.log](03-accept-language-zh.log)
4. 在 Free 列点「Start free」。
   预期：跳到 GitHub 上最新的 WildCrane 桌面端发布页，可下载安装包。
   证据：[04-start-free.png](04-start-free.png)
5. 回到价格页，在 Pro 列点「Upgrade to Pro」。
   预期：跳到 GitHub 登录，授权后回到价格页并进入付款。
   实际：已到 GitHub 登录页；登录与付款需要真实账号，未继续。
   证据：[05-upgrade.png](05-upgrade.png)

## Feedback

页面干净，一屏看完两档方案，中英文切换即时且按浏览器语言自动选择；积分单价现在摆明了，买之前能算账。
摩擦点：「Standard 160 · Premium 270」只说积分，没说这些积分和月度 5000 的关系，要自己换算；
生图一行在桌面宽度折成两行，比其他行显得挤。「Start free」落到 GitHub 发布页，满屏英文导航和安装
说明，与「免费开始」的预期差距大；「Upgrade to Pro」先到 GitHub 登录，授权页是否仍写旧品牌这次
没走到。
