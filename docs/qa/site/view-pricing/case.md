# 在官网查看价格

## Setup

- 浏览器英文界面，打开 `https://wildcrane.ai/`。

## Steps

1. 点顶栏「Pricing」。
   预期：进入 `/pricing`，默认选中「Yearly」（带「Save 33%」）；Free $0，Pro $120 / year，划掉的 $180，注明「$10 a month, billed yearly」。
   证据：[01-yearly.png](01-yearly.png)
2. 点「Monthly」。
   预期：Pro 价格滚动到 $15 / month，按钮仍是「Start 7-day free trial」。
   证据：[02-monthly.png](02-monthly.png)
3. 点 Pro 列「5,000 AI credits a month」旁的「Credit costs」。
   预期：就地展开额度说明：配音 1 credit / second，图片 320 credits each，音乐 160 credits / track。
   证据：[03-credit-costs.png](03-credit-costs.png)

## Feedback

两档方案一屏看完，年付和月付切换即时，额度换算就地展开、不用跳页，读起来很省力。摩擦点：
这里的 Pro 是 $15/月（年付 $10/月），而 `api.ai4kanban.dev/pricing` 写的是 $19，用户在两处看到
不同的价格会犹豫；图片只给一个 320 credits 的单价，没有体现 Cloud 已有的经济、标准、高级三档。
