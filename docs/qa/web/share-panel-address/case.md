# 在任务页分享，拿到 Web 上的链接地址

## Setup

- 本地云端栈（见 README「如何运行取证」），Worker 的 `APP_URL` 指向本地 Web，所以地址是
  `127.0.0.1:5731/s/<链接码>`，线上对应 `app.wildcrane.ai/s/<链接码>`。alice 是所有者，任务 `#1` 在等审核，
  这个浏览器没存过链接。
- 取证时替换 `navigator.clipboard.writeText` 记下写入的内容，无头 Chrome 读不了剪贴板。

## Steps

1. 打开任务页，点「分享」。
   预期：面板顶部是 Web 地址下的 `/s/<链接码>`，旁边「复制链接」。
   证据：[01-panel.png](01-panel.png)
2. 点「复制链接」。
   预期：按钮提示已复制，复制的是完整地址，与面板一致。
   证据：[02-copied.png](02-copied.png)、[02-clipboard.log](02-clipboard.log)
3. 打开复制的地址。
   预期：所有者直接到任务页。
   证据：[03-open-copied.png](03-open-copied.png)
4. 这个浏览器存的是旧地址 `https://review.wildcrane.ai/<链接码>`（取证时改写 localStorage），刷新后点「分享」。
   预期：显示 Web 地址，链接码不变，没有多出一条链接。
   证据：[04-old-address.png](04-old-address.png)
5. 点「撤销链接」并确认。
   预期：面板显示「链接已撤销」和「生成新链接」。
   证据：[05-revoked.png](05-revoked.png)
6. 点「生成新链接」。
   预期：新的链接码，地址同样在 Web 下。
   证据：[06-new-link.png](06-new-link.png)

## Feedback

地址干净，复制一次到位，旧地址悄悄换新，用户无感。摩擦点：地址被截断，看不出是不是新域名；旧域名下线后，已发出去的
旧链接打不开，面板也不提醒；这条链接是点「分享」时自动建的，只是看一眼也会多出一条。
